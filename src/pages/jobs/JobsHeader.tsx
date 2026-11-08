import React from 'react';
import { Plus, Download, Calendar, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, PageHeader } from '../../components/ui';
import { OverflowMenu } from '../../components/ui/list';

interface JobsHeaderProps {
  onNewJob: () => void;
  onExport: () => void;
  onImport: () => void;
}

export const JobsHeader: React.FC<JobsHeaderProps> = ({ onNewJob, onExport, onImport }) => {
  const navigate = useNavigate();

  return (
    <PageHeader
      title="Jobs"
      subtitle="Every insulation project, from booking to payment."
      actions={
        <>
          <OverflowMenu
            actions={[
              { label: 'Export to CSV', icon: Download, onClick: onExport },
              { label: 'Import jobs', icon: Upload, onClick: onImport },
            ]}
          />
          <Button variant="secondary" icon={Calendar} onClick={() => navigate('/scheduling')}>
            Calendar
          </Button>
          <Button icon={Plus} onClick={onNewJob}>
            New job
          </Button>
        </>
      }
    />
  );
};
