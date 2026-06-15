use pyo3::exceptions::PyValueError;
use pyo3::prelude::*;
use pyo3::types::PyDict;

#[derive(Clone, Debug)]
struct AssignmentResult {
    assignments: Vec<Vec<usize>>,
    loads: Vec<usize>,
    capacity: usize,
    overflow_tokens: usize,
}

fn capacity_for(n_tokens: usize, n_experts: usize, k: usize, base_density: f64) -> usize {
    let total_slots = n_tokens.saturating_mul(k);
    let fair_share = (total_slots + n_experts - 1) / n_experts;
    let phase_headroom = ((fair_share as f64) * base_density.max(0.0)).ceil() as usize;
    fair_share + phase_headroom
}

fn validate_shape(scores: &[Vec<f64>], n_experts: usize, k: usize) -> PyResult<()> {
    if scores.is_empty() {
        return Err(PyValueError::new_err("scores must contain at least one token row"));
    }
    if n_experts == 0 {
        return Err(PyValueError::new_err("n_experts must be greater than zero"));
    }
    if k == 0 || k > n_experts {
        return Err(PyValueError::new_err("k must be in the range 1..=n_experts"));
    }
    for (idx, row) in scores.iter().enumerate() {
        if row.len() != n_experts {
            return Err(PyValueError::new_err(format!(
                "scores row {idx} has {} experts, expected {n_experts}",
                row.len()
            )));
        }
    }
    Ok(())
}

fn topk_phase_balanced(scores: Vec<Vec<f64>>, n_experts: usize, k: usize, base_density: f64) -> PyResult<AssignmentResult> {
    validate_shape(&scores, n_experts, k)?;
    let n_tokens = scores.len();
    let capacity = capacity_for(n_tokens, n_experts, k, base_density);
    let mut loads = vec![0usize; n_experts];
    let mut assignments = Vec::with_capacity(n_tokens);
    let mut overflow_tokens = 0usize;
    let phase_width = n_experts.max(1);

    for (token_idx, row) in scores.iter().enumerate() {
        let phase = token_idx % phase_width;
        let mut ranked: Vec<usize> = (0..n_experts).collect();
        ranked.sort_by(|a, b| {
            let score_cmp = row[*b].partial_cmp(&row[*a]).unwrap_or(std::cmp::Ordering::Equal);
            if score_cmp == std::cmp::Ordering::Equal {
                let da = ((*a + n_experts - phase) % n_experts) as isize;
                let db = ((*b + n_experts - phase) % n_experts) as isize;
                da.cmp(&db).then_with(|| a.cmp(b))
            } else {
                score_cmp
            }
        });

        let mut token_assignments = Vec::with_capacity(k);
        for expert in ranked.iter().copied() {
            if token_assignments.len() == k {
                break;
            }
            if loads[expert] < capacity {
                token_assignments.push(expert);
                loads[expert] += 1;
            }
        }

        if token_assignments.len() < k {
            overflow_tokens += 1;
            let mut by_load: Vec<usize> = (0..n_experts).collect();
            by_load.sort_by_key(|expert| (loads[*expert], (*expert + n_experts - phase) % n_experts, *expert));
            for expert in by_load {
                if token_assignments.len() == k {
                    break;
                }
                if !token_assignments.contains(&expert) {
                    token_assignments.push(expert);
                    loads[expert] += 1;
                }
            }
        }

        assignments.push(token_assignments);
    }

    Ok(AssignmentResult {
        assignments,
        loads,
        capacity,
        overflow_tokens,
    })
}

fn uniform_assign(n_tokens: usize, n_experts: usize, k: usize) -> PyResult<AssignmentResult> {
    if n_tokens == 0 {
        return Err(PyValueError::new_err("n_tokens must be greater than zero"));
    }
    if n_experts == 0 {
        return Err(PyValueError::new_err("n_experts must be greater than zero"));
    }
    if k == 0 || k > n_experts {
        return Err(PyValueError::new_err("k must be in the range 1..=n_experts"));
    }

    let mut loads = vec![0usize; n_experts];
    let mut assignments = Vec::with_capacity(n_tokens);
    let stride = (n_experts / k.max(1)).max(1);
    for token_idx in 0..n_tokens {
        let phase = token_idx % n_experts;
        let mut token_assignments = Vec::with_capacity(k);
        for rank in 0..k {
            let expert = (phase + rank * stride) % n_experts;
            token_assignments.push(expert);
            loads[expert] += 1;
        }
        assignments.push(token_assignments);
    }
    let capacity = loads.iter().copied().max().unwrap_or(0);
    Ok(AssignmentResult {
        assignments,
        loads,
        capacity,
        overflow_tokens: 0,
    })
}

fn result_to_dict(py: Python<'_>, mode: &str, result: AssignmentResult) -> PyResult<PyObject> {
    let dict = PyDict::new_bound(py);
    dict.set_item("mode", mode)?;
    dict.set_item("assignments", result.assignments)?;
    dict.set_item("loads", result.loads.clone())?;
    dict.set_item("capacity", result.capacity)?;
    dict.set_item("overflow_tokens", result.overflow_tokens)?;
    let min_load = result.loads.iter().copied().min().unwrap_or(0);
    let max_load = result.loads.iter().copied().max().unwrap_or(0);
    dict.set_item("min_load", min_load)?;
    dict.set_item("max_load", max_load)?;
    dict.set_item("imbalance", max_load.saturating_sub(min_load))?;
    Ok(dict.into())
}

#[pyfunction]
#[pyo3(signature = (scores, k=2, base_density=0.3))]
fn phase_topk(py: Python<'_>, scores: Vec<Vec<f64>>, k: usize, base_density: f64) -> PyResult<PyObject> {
    let n_experts = scores.first().map(|row| row.len()).unwrap_or(0);
    let result = topk_phase_balanced(scores, n_experts, k, base_density)?;
    result_to_dict(py, "phase_topk", result)
}

#[pyfunction]
#[pyo3(signature = (n_tokens=8192, n_experts=32, k=2))]
fn uniform_dispatch(py: Python<'_>, n_tokens: usize, n_experts: usize, k: usize) -> PyResult<PyObject> {
    let result = uniform_assign(n_tokens, n_experts, k)?;
    result_to_dict(py, "uniform_dispatch", result)
}

#[pymodule]
fn _phase_router_rs(module: &Bound<'_, PyModule>) -> PyResult<()> {
    module.add_function(wrap_pyfunction!(phase_topk, module)?)?;
    module.add_function(wrap_pyfunction!(uniform_dispatch, module)?)?;
    Ok(())
}
