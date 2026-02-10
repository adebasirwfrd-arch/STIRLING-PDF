import React from 'react';
import { Menu, Button } from '@mantine/core';
import LocalIcon from '@app/components/shared/LocalIcon';
import { useTranslation } from 'react-i18next';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDownRounded';

interface FileMenuProps {
  onSave?: () => void;
  onSaveAs?: () => void;
  onPrint?: () => void;
  onClose?: () => void;
  disabled?: boolean;
}

export const FileMenu: React.FC<FileMenuProps> = ({
  onSave,
  onSaveAs,
  onPrint,
  onClose,
  disabled
}) => {
  const { t } = useTranslation();

  return (
    <Menu shadow="md" width={200} position="bottom-start" disabled={disabled}>
      <Menu.Target>
        <Button 
          variant="subtle" 
          color="dark" 
          size="sm"
          rightSection={<KeyboardArrowDownIcon style={{ fontSize: '1rem' }} />}
          disabled={disabled}
          styles={{
            root: {
              color: 'var(--text-color)',
              '&:hover': {
                backgroundColor: 'var(--bg-toolbar-hover)',
              }
            }
          }}
        >
          {t('fileMenu.file', 'File')}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item 
          leftSection={<LocalIcon icon="save-rounded" width="1rem" />}
          onClick={onSave}
          disabled={!onSave}
        >
          {t('fileMenu.save', 'Save')}
        </Menu.Item>
        
        <Menu.Item 
          leftSection={<LocalIcon icon="save-as-rounded" width="1rem" />}
          onClick={onSaveAs}
          disabled={!onSaveAs}
        >
          {t('fileMenu.saveAs', 'Save As...')}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item 
          leftSection={<LocalIcon icon="print-rounded" width="1rem" />}
          onClick={onPrint}
          disabled={!onPrint}
        >
          {t('fileMenu.print', 'Print')}
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item 
          color="red" 
          leftSection={<LocalIcon icon="close-rounded" width="1rem" />}
          onClick={onClose}
          disabled={!onClose}
        >
          {t('fileMenu.close', 'Close')}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};
