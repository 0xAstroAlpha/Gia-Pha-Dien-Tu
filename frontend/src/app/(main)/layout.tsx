import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen overflow-hidden">
            <Sidebar />
            <div className="flex flex-1 min-w-0 flex-col">
                <Header />
                <main className="flex-1 min-w-0 overflow-hidden p-4 lg:p-6">{children}</main>
            </div>
        </div>
    );
}
