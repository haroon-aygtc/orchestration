import { CustomToolManager } from '@/components/ui/custom-tool-manager';

export default function CustomToolsPage() {
  return (
    <div className="container mx-auto py-8">
      <CustomToolManager />
    </div>
  );
}

export const metadata = {
  title: 'Custom Tools - AI Agent Architecture',
  description: 'Create and manage custom tools with advanced features including caching, validation, and monitoring.',
};
