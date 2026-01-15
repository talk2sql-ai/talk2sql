import { Outlet } from 'react-router-dom';
import SidebarLayout from './SidebarLayout';

export function DashboardWrapper() {
    return (
        <SidebarLayout>
            <Outlet />
        </SidebarLayout>
    );
}
