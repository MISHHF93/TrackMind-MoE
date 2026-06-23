import { useEffect, useRef, type RefObject } from 'react';
import { useSearchParams } from 'react-router-dom';

export const SURVEILLANCE_GOVERNANCE_SECTION_ID = 'surveillance-governance';

/** Deep-link support for `/cctv-registry?focus=governance` and `/iot-registry?focus=governance`. */
export function useSurveillanceGovernanceFocus(): {
  governanceFocus: boolean;
  governanceSectionRef: RefObject<HTMLDivElement | null>;
} {
  const [searchParams] = useSearchParams();
  const governanceFocus = searchParams.get('focus') === 'governance';
  const governanceSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!governanceFocus) return;
    governanceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [governanceFocus]);

  return { governanceFocus, governanceSectionRef };
}
