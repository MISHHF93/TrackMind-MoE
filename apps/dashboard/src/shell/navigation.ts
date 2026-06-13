import { hasPermission, type Permission, type Role } from '@trackmind/shared';
export interface NavItem { id:string; label:string; path:string; required?: Permission[]; eventReady:boolean; mockAllowed:boolean }
export const navItems: NavItem[] = [
 {id:'operations',label:'Operations Command',path:'/operations',required:['read:any'],eventReady:true,mockAllowed:true},
 {id:'race-office',label:'Race Office',path:'/race-office',required:['race:request-start'],eventReady:true,mockAllowed:true},
 {id:'assets',label:'Asset Registry',path:'/assets',required:['read:any'],eventReady:true,mockAllowed:true},
 {id:'digital-twin',label:'Digital Twin View',path:'/digital-twin',required:['read:any'],eventReady:true,mockAllowed:true},
 {id:'starting-gate',label:'Starting Gate Control',path:'/starting-gate',required:['race:request-start'],eventReady:true,mockAllowed:true},
 {id:'surface',label:'Surface Intelligence',path:'/surface',required:['track:readings'],eventReady:true,mockAllowed:true},
 {id:'equine',label:'Equine Intelligence',path:'/equine',required:['vet:review'],eventReady:true,mockAllowed:true},
 {id:'stewards',label:'Steward Center',path:'/stewards',required:['discipline:issue'],eventReady:true,mockAllowed:true},
 {id:'approvals',label:'Approvals',path:'/approvals',required:['ai:approve'],eventReady:true,mockAllowed:false},
 {id:'audit',label:'Audit Ledger',path:'/audit',required:['compliance:audit'],eventReady:true,mockAllowed:false},
 {id:'security',label:'Security',path:'/security',required:['security:manage'],eventReady:true,mockAllowed:true},
 {id:'emergency',label:'Emergency Ops',path:'/emergency',required:['incident:manage'],eventReady:true,mockAllowed:true},
 {id:'compliance',label:'Compliance',path:'/compliance',required:['compliance:audit'],eventReady:true,mockAllowed:true},
 {id:'ai-governance',label:'AI Governance',path:'/ai-governance',required:['ai:approve'],eventReady:true,mockAllowed:true},
 {id:'executive',label:'Executive Center',path:'/executive',required:['read:any'],eventReady:true,mockAllowed:true},
];
export function visibleNavItems(roles: Role[]): NavItem[] { return navItems.filter((item) => !item.required?.length || roles.some((role) => item.required!.some((p) => hasPermission(role, p)))); }
