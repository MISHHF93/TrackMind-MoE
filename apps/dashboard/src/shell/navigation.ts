import { hasPermission, type Permission, type Role } from '@trackmind/shared';
export type NavSection = 'operations' | 'equine' | 'safety' | 'facilities' | 'governance' | 'executive';
export interface NavItem { id:string; label:string; path:string; required?: Permission[]; eventReady:boolean; mockAllowed:boolean; section: NavSection }
export const navItems: NavItem[] = [
 {id:'operations',label:'Operations Command',path:'/operations',required:['read:any'],eventReady:true,mockAllowed:true,section:'operations'},
 {id:'race-office',label:'Race Office',path:'/race-office',required:['race:request-start'],eventReady:true,mockAllowed:true,section:'operations'},
 {id:'assets',label:'Asset Registry',path:'/assets',required:['read:any'],eventReady:true,mockAllowed:true,section:'facilities'},
 {id:'digital-twin',label:'Digital Twin',path:'/digital-twin',required:['read:any'],eventReady:true,mockAllowed:true,section:'facilities'},
 {id:'starting-gate',label:'Starting Gate Control',path:'/starting-gate',required:['race:request-start'],eventReady:true,mockAllowed:true,section:'operations'},
 {id:'surface',label:'Surface Intelligence',path:'/surface',required:['track:readings'],eventReady:true,mockAllowed:true,section:'operations'},
 {id:'equine',label:'Veterinary Center',path:'/equine',required:['vet:review'],eventReady:true,mockAllowed:true,section:'equine'},
 {id:'stewards',label:'Race Stewarding',path:'/stewards',required:['discipline:issue'],eventReady:true,mockAllowed:true,section:'safety'},
 {id:'approvals',label:'Approvals',path:'/approvals',required:['ai:approve'],eventReady:true,mockAllowed:false,section:'governance'},
 {id:'audit',label:'Audit Ledger',path:'/audit',required:['compliance:audit'],eventReady:true,mockAllowed:false,section:'governance'},
 {id:'security',label:'Security Operations',path:'/security',required:['security:manage'],eventReady:true,mockAllowed:true,section:'safety'},
 {id:'emergency',label:'Emergency Operations',path:'/emergency',required:['incident:manage'],eventReady:true,mockAllowed:true,section:'safety'},
 {id:'compliance',label:'Compliance',path:'/compliance',required:['compliance:audit'],eventReady:true,mockAllowed:true,section:'governance'},
 {id:'ai-governance',label:'AI Command Center',path:'/ai-governance',required:['ai:approve'],eventReady:true,mockAllowed:true,section:'governance'},
 {id:'executive',label:'Executive Center',path:'/executive',required:['read:any'],eventReady:true,mockAllowed:true,section:'executive'},
];
export function visibleNavItems(roles: Role[]): NavItem[] { return navItems.filter((item) => !item.required?.length || roles.some((role) => item.required!.some((p) => hasPermission(role, p)))); }

export const navSections: Array<{ id: NavSection; label: string }> = [
  { id: 'operations', label: 'OPERATIONS' },
  { id: 'equine', label: 'EQUINE' },
  { id: 'safety', label: 'SAFETY' },
  { id: 'facilities', label: 'FACILITIES' },
  { id: 'governance', label: 'GOVERNANCE' },
  { id: 'executive', label: 'EXECUTIVE' },
];

export function groupedVisibleNavItems(roles: Role[]): Array<{ section: typeof navSections[number]; items: NavItem[] }> {
  const visible = visibleNavItems(roles);
  return navSections.map((section) => ({ section, items: visible.filter((item) => item.section === section.id) })).filter((group) => group.items.length > 0);
}
