'use client';

import { CommandGroup, CommandItem } from '@/components/ui/command';
import { Upload, Plus, FileText, FolderOpen, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ActionListProps {
  onSelect: () => void;
}

export function ActionList({ onSelect }: ActionListProps) {
  const router = useRouter();

  const actions = [
    {
      id: 'upload',
      label: 'Upload Document',
      icon: Upload,
      action: () => {
        onSelect();
        const uploadButton = document.querySelector('[data-testid="upload-button"]') as HTMLButtonElement | null;
        uploadButton?.click();
      },
    },
    {
      id: 'new-conversation',
      label: 'New Conversation',
      icon: Plus,
      action: () => {
        onSelect();
        router.push('/');
      },
    },
    {
      id: 'documents',
      label: 'View All Documents',
      icon: FileText,
      action: () => {
        onSelect();
        router.push('/documents');
      },
    },
    {
      id: 'collections',
      label: 'View All Collections',
      icon: FolderOpen,
      action: () => {
        onSelect();
        router.push('/collections');
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      action: () => {
        onSelect();
        router.push('/settings/connectors');
      },
    },
  ];

  return (
    <CommandGroup heading="Quick Actions">
      {actions.map((action) => (
        <CommandItem
          key={action.id}
          value={action.id}
          onSelect={action.action}
        >
          <action.icon className="h-4 w-4 text-muted-foreground" />
          <span>{action.label}</span>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
