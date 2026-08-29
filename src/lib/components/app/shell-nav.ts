import type { Component } from 'svelte';
import type { Role } from '$lib/types';
import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
import PlusCircleIcon from '@lucide/svelte/icons/plus-circle';
import UsersIcon from '@lucide/svelte/icons/users';
import GraduationCapIcon from '@lucide/svelte/icons/graduation-cap';

import HistoryIcon from '@lucide/svelte/icons/history';
import MegaphoneIcon from '@lucide/svelte/icons/megaphone';
import BuildingIcon from '@lucide/svelte/icons/building';

import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
import TrendingUpIcon from '@lucide/svelte/icons/trending-up';

export interface ShellNavItem {
	label: string;
	href: string;
	icon: Component;
}

export function shellNav(role: Role): ShellNavItem[] {
	switch (role) {
		case 'student':
			return [
				{ label: 'Dashboard', href: '/student', icon: LayoutDashboardIcon },
				{ label: 'Notice Board', href: '/student/notices', icon: MegaphoneIcon },
				{ label: 'Grievances', href: '/student/grievances', icon: ClipboardListIcon },
				{ label: 'New Grievance', href: '/student/grievances/new', icon: PlusCircleIcon },
				{ label: 'Help & FAQ', href: '/student/help', icon: HelpCircleIcon }
			];
		case 'warden':
			return [
				{ label: 'Dashboard', href: '/warden', icon: LayoutDashboardIcon },
				{ label: 'Grievances', href: '/warden/grievances', icon: ClipboardListIcon },
				{ label: 'Manage Students', href: '/warden/students', icon: GraduationCapIcon },
				{ label: 'Notice Board', href: '/warden/notices', icon: MegaphoneIcon },
				{ label: 'Help & FAQ', href: '/warden/help', icon: HelpCircleIcon }
			];
		case 'admin':
			return [
				{ label: 'Dashboard', href: '/admin', icon: LayoutDashboardIcon },
				{ label: 'Analytics', href: '/admin/analytics', icon: TrendingUpIcon },
				{ label: 'All Grievances', href: '/admin/grievances', icon: ClipboardListIcon },
				{ label: 'Hostels', href: '/admin/hostels', icon: BuildingIcon },
				{ label: 'User Management', href: '/admin/users', icon: UsersIcon },
				{ label: 'Notice Board', href: '/admin/notices', icon: MegaphoneIcon },
				{ label: 'Audit Logs', href: '/admin/audit-logs', icon: HistoryIcon },
				{ label: 'Help & FAQ', href: '/admin/help', icon: HelpCircleIcon }
			];
		default: {
			const _exhaustive: never = role;
			return _exhaustive;
		}
	}
}

export function activeNavHref(pathname: string, items: ShellNavItem[]): string | undefined {
	return [...items]
		.sort((a, b) => b.href.length - a.href.length)
		.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.href;
}
