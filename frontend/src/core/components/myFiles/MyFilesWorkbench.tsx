import React, { useEffect, useState, useMemo } from 'react';
import { Box, Stack, Text, Group, Card, Image, Button, ActionIcon, Title, Badge, SimpleGrid, Breadcrumbs, Anchor, Checkbox, Menu, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useFileStorage } from '@app/services/fileStorage';
import { useFileActions, useFileContext } from '@app/contexts/file/fileHooks';
import { useNavigationActions } from '@app/contexts/NavigationContext';
import { useToolWorkflow } from '@app/contexts/ToolWorkflowContext';
import LocalIcon from '@app/components/shared/LocalIcon';
import { StirlingFileStub } from '@app/types/fileContext';
import { FileId } from '@app/types/file';

export default function MyFilesWorkbench() {
  const { t } = useTranslation();
  const fileStorage = useFileStorage();
  const { actions: fileActions } = useFileActions();
  const { actions: navActions } = useNavigationActions();
  const { handleToolSelect } = useToolWorkflow();

  const [allScans, setAllScans] = useState<StirlingFileStub[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<FileId>>(new Set());

  // Load all scans on mount
  const loadScans = async () => {
    setLoading(true);
    try {
      const stubs = await fileStorage.getAllStirlingFileStubs();
      // Filter by "scan" tag
      const scans = stubs.filter(s => s.tags?.includes('scan'));
      setAllScans(scans);
    } catch (error) {
      console.error('Failed to load scans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

  // Group by folder
  const folders = useMemo(() => {
    const map = new Map<string, StirlingFileStub[]>();
    allScans.forEach(scan => {
      const folder = scan.folder || 'Uncategorized';
      if (!map.has(folder)) map.set(folder, []);
      map.get(folder)!.push(scan);
    });
    return Array.from(map.entries()).map(([name, files]) => ({ name, files }));
  }, [allScans]);

  const currentFolderFiles = useMemo(() => {
    if (!currentFolder) return [];
    return folders.find(f => f.name === currentFolder)?.files || [];
  }, [currentFolder, folders]);

  const toggleSelection = (id: FileId) => {
    const newSelected = new Set(selectedFileIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedFileIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFileIds(new Set(currentFolderFiles.map(f => f.id)));
    } else {
      setSelectedFileIds(new Set());
    }
  };

  const handleConvertToPdf = async () => {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0) return;

    try {
      const stirlingFiles = await fileStorage.getStirlingFiles(ids);
      await fileActions.addFiles(stirlingFiles);
      handleToolSelect('merge');
    } catch (error) {
      console.error('Failed to convert to PDF:', error);
    }
  };

  const handleSaveToGallery = async () => {
    const ids = Array.from(selectedFileIds);
    for (const id of ids) {
      const file = await fileStorage.getStirlingFile(id);
      if (file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };

  const handleDelete = async () => {
    const ids = Array.from(selectedFileIds);
    if (!confirm(t('myFiles.confirmDelete', 'Are you sure you want to delete these files?'))) return;

    try {
      for (const id of ids) {
        await fileStorage.deleteStirlingFile(id);
      }
      setSelectedFileIds(new Set());
      await loadScans();
    } catch (error) {
      console.error('Failed to delete files:', error);
    }
  };

  if (loading) {
    return (
      <Box h="100%" p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size="xl" />
      </Box>
    );
  }

  return (
    <Box h="100%" p="lg" style={{ backgroundColor: 'var(--bg-background)', overflowY: 'auto' }}>
      <Stack gap="xl">
        <Group justify="space-between">
          <Title order={2}>
            {currentFolder ? (
              <Group gap="xs">
                <ActionIcon variant="subtle" onClick={() => setCurrentFolder(null)}>
                  <LocalIcon icon="arrow-back" />
                </ActionIcon>
                <Text size="xl" fw={700}>{currentFolder}</Text>
              </Group>
            ) : t('myFiles.title', 'My Files')}
          </Title>
        
        {currentFolder && selectedFileIds.size > 0 && (
          <Group>
            <Button leftSection={<LocalIcon icon="picture-as-pdf" />} color="blue" onClick={handleConvertToPdf}>
              {t('myFiles.convertToPdf', 'Convert to PDF')}
            </Button>
            <Button leftSection={<LocalIcon icon="download" />} variant="outline" color="green" onClick={handleSaveToGallery}>
              {t('myFiles.saveToGallery', 'Save to Gallery')}
            </Button>
            <ActionIcon color="red" variant="subtle" size="lg" onClick={handleDelete}>
              <LocalIcon icon="delete" />
            </ActionIcon>
          </Group>
        )}
      </Group>

      {/* folders section */}
      {!currentFolder ? (
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
            {folders.map(folder => (
              <Card 
                key={folder.name} 
                shadow="sm" 
                p="lg" 
                radius="md" 
                withBorder 
                style={{ cursor: 'pointer', '&:hover': { background: 'var(--mantine-color-gray-0)' } }}
                onClick={() => setCurrentFolder(folder.name)}
              >
                <Group justify="space-between">
                  <Group gap="sm">
                    <LocalIcon icon="folder-rounded" width="2rem" height="2rem" style={{ color: "var(--mantine-color-blue-6)" }} />
                    <Stack gap={0}>
                      <Text fw={500}>{folder.name}</Text>
                      <Text size="xs" color="dimmed">{folder.files.length} {t('myFiles.files', 'files')}</Text>
                    </Stack>
                  </Group>
                  <LocalIcon icon="chevron-right" style={{ color: 'var(--mantine-color-gray-5)' }} />
                </Group>
              </Card>
            ))}
            {folders.length === 0 && (
              <Box p="xl" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
                <Text color="dimmed">{t('myFiles.noScans', 'No scans yet. Use the camera to start scanning!')}</Text>
              </Box>
            )}
          </SimpleGrid>
        ) : (
          <Stack>
            <Group>
              <Checkbox 
                label={t('myFiles.selectAll', 'Select All')} 
                checked={selectedFileIds.size === currentFolderFiles.length && currentFolderFiles.length > 0} 
                indeterminate={selectedFileIds.size > 0 && selectedFileIds.size < currentFolderFiles.length}
                onChange={(e) => handleSelectAll(e.currentTarget.checked)}
              />
              <Text size="sm" color="dimmed">{selectedFileIds.size} selected</Text>
            </Group>

            <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="md">
              {currentFolderFiles.map(file => (
                <Card 
                  key={file.id} 
                  shadow="xs" 
                  p="xs" 
                  radius="md" 
                  withBorder
                  style={{ 
                    border: selectedFileIds.has(file.id) ? '2px solid var(--mantine-color-blue-5)' : undefined,
                    position: 'relative'
                  }}
                >
                  <Box style={{ position: 'absolute', top: '5px', left: '5px', zIndex: 10 }}>
                    <Checkbox 
                      checked={selectedFileIds.has(file.id)} 
                      onChange={() => toggleSelection(file.id)}
                    />
                  </Box>
                  <Card.Section onClick={() => toggleSelection(file.id)} style={{ cursor: 'pointer' }}>
                    <Image
                      src={file.thumbnailUrl}
                      height={160}
                      alt={file.name}
                      fallbackSrc="https://placehold.co/160x160?text=Scan"
                    />
                  </Card.Section>
                  <Text size="xs" mt="xs" truncate fw={500}>{file.name}</Text>
                  <Text size="xs" color="dimmed">
                    {(file.size / 1024).toFixed(1)} KB
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
