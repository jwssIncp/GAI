import { Building2, ContactRound, FolderKanban, Landmark, LayoutDashboard, ShieldCheck, Users } from 'lucide-react';

export const navigation = [
  { label: 'Visão geral', to: '/app/dashboard', icon: LayoutDashboard, section: 'workspace' },
  { label: 'Projetos', to: '/app/projects', icon: FolderKanban, permissions: ['projects:read'], section: 'workspace' },
  { label: 'Inventariantes', to: '/app/field-agents', icon: ContactRound, permissions: ['field-agents:read'], section: 'workspace' },
  { label: 'Organizações', to: '/app/organizations', icon: Landmark, permissions: ['organizations:read'], section: 'management' },
  { label: 'Usuários', to: '/app/users', icon: Users, permissions: ['users:read'], section: 'management' },
  { label: 'Perfis e acessos', to: '/app/roles', icon: ShieldCheck, permissions: ['org_roles:read'], section: 'management' },
  { label: 'Empresas', to: '/app/companies', icon: Building2, permissions: ['companies:read'], section: 'management' },
];
