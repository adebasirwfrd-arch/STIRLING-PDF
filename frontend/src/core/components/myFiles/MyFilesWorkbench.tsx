import React, { useEffect, useState, useMemo } from 'react';
import { Box, Stack, Text, Group, Card, Image, Button, ActionIcon, Title, Badge, SimpleGrid, Breadcrumbs, Anchor, Checkbox, Menu, Loader, Modal, Slider, Select, TextInput, Tooltip, Divider } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { useFileStorage } from '@app/services/fileStorage';
import { useFileActions, useFileContext } from '@app/contexts/file/fileHooks';
import { useNavigationActions } from '@app/contexts/NavigationContext';
import { useToolWorkflow } from '@app/contexts/ToolWorkflowContext';
import LocalIcon from '@app/components/shared/LocalIcon';
import { StirlingFileStub } from '@app/types/fileContext';
import { FileId } from '@app/types/file';
import { getGoogleDrivePickerService, getGoogleDriveConfig, isGoogleDriveConfigured } from '@app/services/googleDrivePickerService';

// --- Effects Modal Component ---
interface EffectsModalProps {
  opened: boolean;
  onClose: () => void;
  files: StirlingFileStub[];
  onApply: (params: any) => Promise<void>;
}

const EffectsModal = ({ opened, onClose, files, onApply }: EffectsModalProps) => {
  const { t } = useTranslation();
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [filter, setFilter] = useState('none');
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);
    await onApply({ brightness, contrast, scannyFilter: filter });
    setLoading(false);
    onClose();
  };

  return (
    <Modal opened={opened} onClose={onClose} title={t('myFiles.applyEffects', 'Apply Effects')} size="md">
      <Stack gap="md">
        <Text size="sm">{t('myFiles.brightness', 'Brightness')}</Text>
        <Slider value={brightness} onChange={setBrightness} min={-1} max={1} step={0.1} />
        
        <Text size="sm">{t('myFiles.contrast', 'Contrast')}</Text>
        <Slider value={contrast} onChange={setContrast} min={0} max={2} step={0.1} />
        
        <Select
          label={t('myFiles.filter', 'Filter')}
          value={filter}
          onChange={(v) => setFilter(v || 'none')}
          data={[
            { value: 'none', label: t('myFiles.none', 'None') },
            { value: 'magic_color', label: t('myFiles.magicColor', 'Magic Color') },
            { value: 'black_white', label: t('myFiles.enhancedBW', 'Enhanced B&W') },
          ]}
        />
        
        <Button onClick={handleApply} loading={loading} fullWidth mt="md">
          {t('myFiles.applyEffects', 'Apply Effects')}
        </Button>
      </Stack>
    </Modal>
  );
};

// --- File Preview Modal Component ---
interface FilePreviewModalProps {
  opened: boolean;
  onClose: () => void;
  file: StirlingFileStub;
  fileUrl: string | null;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
  actions: {
    onEffects: () => void;
    onShare: () => void;
    onPrint: () => void;
    onDelete: () => void;
  };
}

const FilePreviewModal = ({ opened, onClose, file, fileUrl, onPrev, onNext, loading, actions }: FilePreviewModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal opened={opened} onClose={onClose} fullScreen padding={0} withCloseButton={false} styles={{ content: { background: 'black' } }}>
      <Box h="100vh" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Group justify="space-between" p="md" style={{ background: 'rgba(0,0,0,0.5)', zIndex: 100 }}>
          <Group>
            <ActionIcon variant="transparent" color="white" onClick={onClose}>
              <LocalIcon icon="close" />
            </ActionIcon>
            <Text color="white" fw={500}>{file.name}</Text>
          </Group>
          <Group>
            <Tooltip label={t('myFiles.effects', 'Effects')}>
              <ActionIcon variant="light" color="indigo" size="lg" onClick={actions.onEffects}>
                <LocalIcon icon="auto-fix-high" />
              </ActionIcon>
            </Tooltip>
            {fileUrl && (
              <>
                <Tooltip label={t('myFiles.share', 'Share')}>
                  <ActionIcon variant="light" color="teal" size="lg" onClick={actions.onShare}>
                    <LocalIcon icon="share-rounded" />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label={t('myFiles.print', 'Print')}>
                  <ActionIcon variant="light" color="gray" size="lg" onClick={actions.onPrint}>
                    <LocalIcon icon="print" />
                  </ActionIcon>
                </Tooltip>
              </>
            )}
            <ActionIcon variant="light" color="red" size="lg" onClick={actions.onDelete}>
              <LocalIcon icon="delete" />
            </ActionIcon>
          </Group>
        </Group>

        {/* Content */}
        <Box style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ActionIcon 
            variant="transparent" 
            color="white" 
            size="xl" 
            onClick={onPrev} 
            style={{ position: 'absolute', left: 20, zIndex: 10, background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}
          >
            <LocalIcon icon="chevron-left" />
          </ActionIcon>

          {loading ? (
            <Loader size="xl" color="white" />
          ) : (
            <Image 
              src={fileUrl || file.thumbnailUrl} 
              fit="contain" 
              h="85vh" 
              alt={file.name} 
              draggable={false}
              fallbackSrc="https://placehold.co/800x600?text=Loading+Preview..."
            />
          )}

          <ActionIcon 
            variant="transparent" 
            color="white" 
            size="xl" 
            onClick={onNext} 
            style={{ position: 'absolute', right: 20, zIndex: 10, background: 'rgba(0,0,0,0.3)', borderRadius: '50%' }}
          >
            <LocalIcon icon="chevron-right" />
          </ActionIcon>
        </Box>
      </Box>
    </Modal>
  );
};

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

  // Preview state
  const [previewOpened, setPreviewOpened] = useState(false);
  const [previewFileIndex, setPreviewFileIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  // Modals state
  const [effectsOpened, setEffectsOpened] = useState(false);
  const [moveOpened, setMoveOpened] = useState(false);
  const [newFolderOpened, setNewFolderOpened] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [targetFolder, setTargetFolder] = useState('');

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

  const selectedFiles = useMemo(() => {
    return allScans.filter(f => selectedFileIds.has(f.id));
  }, [allScans, selectedFileIds]);

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




  const handleSyncToDrive = async () => {
    if (!isGoogleDriveConfigured()) {
        alert(t('myFiles.driveNotConfigured', 'Google Drive is not configured.'));
        return;
    }
    
    setSyncing(true);
    setSyncProgress(t('myFiles.authenticating', 'Authenticating...'));
    
    try {
        const driveService = getGoogleDrivePickerService();
        const config = getGoogleDriveConfig();
        if (config) await driveService.initialize(config);
        
        // Ensure auth
        await driveService.requestAccessToken();
        
        setSyncProgress(t('myFiles.checkingFolder', 'Checking folder...'));
        const folderId = await driveService.ensureFolder('scannereffect');
        
        setSyncProgress(t('myFiles.checkingFiles', 'Checking existing files...'));
        const existingFiles = await driveService.listFilesInFolder(folderId);
        
        const filesToSync = allScans; // Sync all local scans
        let syncedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < filesToSync.length; i++) {
            const fileStub = filesToSync[i];
            const fileName = fileStub.name; 
            
            // Deduplication by name
            if (existingFiles.has(fileName)) {
                skippedCount++;
                continue;
            }
            
            setSyncProgress(t('myFiles.syncingFile', `Syncing ${i + 1}/${filesToSync.length}: ${fileName}`));
            
            try {
                // Fetch actual file blob
                const file = await fileStorage.getStirlingFile(fileStub.id);
                if (file) {
                    await driveService.uploadFile(file, folderId);
                    syncedCount++;
                } else {
                    console.error(`File content missing for ${fileName}`);
                    errorCount++;
                }
            } catch (err) {
                console.error(`Failed to upload ${fileName}:`, err);
                errorCount++;
            }
        }
        
        alert(t('myFiles.syncComplete', `Sync complete!\nUploaded: ${syncedCount}\nSkipped: ${skippedCount}\nErrors: ${errorCount}`));
        
    } catch (error) {
        console.error('Sync failed:', error);
        alert(t('myFiles.syncFailed', `Sync failed: ${(error as Error).message}`));
    } finally {
        setSyncing(false);
        setSyncProgress('');
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

  const handleShare = async () => {
    if (selectedFiles.length === 0) return;
    const file = await fileStorage.getStirlingFile(selectedFiles[0].id);
    if (file && navigator.share) {
      try {
        await navigator.share({
          files: [new File([file], file.name, { type: file.type })],
          title: file.name,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
        alert('Web Share API not supported on this browser/device.');
    }
  };

  const handlePrint = async () => {
    if (selectedFiles.length === 0) return;
    const file = await fileStorage.getStirlingFile(selectedFiles[0].id);
    if (file) {
      const url = URL.createObjectURL(file);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
    }
  };

  const handleApplyEffects = async (params: any) => {
    for (const fileStub of selectedFiles) {
      const file = await fileStorage.getStirlingFile(fileStub.id);
      if (!file) continue;

      const formData = new FormData();
      formData.append('fileInput', file);
      formData.append('brightness', params.brightness.toString());
      formData.append('contrast', params.contrast.toString());
      formData.append('scannyFilter', params.scannyFilter);
      formData.append('colorspace', 'color');
      formData.append('renderResolution', '150');

      try {
        const response = await fetch('/api/v1/misc/scanner-effect', {
          method: 'POST',
          body: formData,
        });
        if (response.ok) {
          const blob = await response.blob();
          const newFile = new File([blob], file.name, { type: 'image/jpeg' });
          const stirlingFile = { fileId: fileStub.id, file: newFile };
          await fileStorage.storeStirlingFile(stirlingFile as any, fileStub);
        }
      } catch (err) {
        console.error('Filter apply failed:', err);
      }
    }
    await loadScans();
  };

  const handleMoveFiles = async () => {
    for (const id of Array.from(selectedFileIds)) {
      const stub = allScans.find(s => s.id === id);
      if (stub) {
        stub.folder = targetFolder;
        // Simplified: store again to update folder metadata
        const stirlingFile = await fileStorage.getStirlingFile(id);
        if (stirlingFile) {
          await fileStorage.storeStirlingFile({ fileId: id, file: stirlingFile } as any, stub);
        }
      }
    }
    setMoveOpened(false);
    await loadScans();
  };

  const handlePrevPreview = () => {
    if (previewFileIndex !== null && previewFileIndex > 0) {
      setPreviewFileIndex(previewFileIndex - 1);
    }
  };

  const handleNextPreview = () => {
    if (previewFileIndex !== null && previewFileIndex < currentFolderFiles.length - 1) {
      setPreviewFileIndex(previewFileIndex + 1);
    }
  };

  const openPreview = (id: FileId) => {
    const index = currentFolderFiles.findIndex(f => f.id === id);
    if (index !== -1) {
      setPreviewFileIndex(index);
      setPreviewOpened(true);
    }
  };

  const previewFile = previewFileIndex !== null ? currentFolderFiles[previewFileIndex] : null;

  // Effect to load full preview URL
  useEffect(() => {
    if (previewFile) {
      const loadPreview = async () => {
        setPreviewLoading(true);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        try {
          const file = await fileStorage.getStirlingFile(previewFile.id);
          if (file) {
            setPreviewUrl(URL.createObjectURL(file));
          }
        } catch (error) {
          console.error('Failed to load full preview:', error);
        } finally {
          setPreviewLoading(false);
        }
      };
      loadPreview();
    } else {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [previewFileIndex, currentFolderFiles]);

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
        
          <Group>
            {!currentFolder && (
              <Group>
                <Button 
                  leftSection={syncing ? <Loader size="xs" color="white" /> : <LocalIcon icon="cloud-upload" />} 
                  variant="light" 
                  color="orange" 
                  onClick={handleSyncToDrive} 
                  loading={syncing}
                  disabled={syncing}
                >
                  {syncing ? (syncProgress || t('myFiles.syncing', 'Syncing...')) : t('myFiles.syncToDrive', 'Sync to Drive')}
                </Button>
                <Button leftSection={<LocalIcon icon="create-new-folder" />} variant="light" onClick={() => setNewFolderOpened(true)}>
                  {t('myFiles.newFolder', 'New Folder')}
                </Button>
              </Group>
            )}
            {currentFolder && selectedFileIds.size > 0 && (
              <Group gap="xs">
                <Tooltip label={t('myFiles.effects', 'Effects')}>
                  <ActionIcon variant="light" size="lg" color="indigo" onClick={() => setEffectsOpened(true)}>
                    <LocalIcon icon="auto-fix-high" />
                  </ActionIcon>
                </Tooltip>
                
                <Tooltip label={t('myFiles.share', 'Share')}>
                  <ActionIcon variant="light" size="lg" color="teal" onClick={handleShare}>
                    <LocalIcon icon="share-rounded" />
                  </ActionIcon>
                </Tooltip>

                <Tooltip label={t('myFiles.print', 'Print')}>
                  <ActionIcon variant="light" size="lg" color="gray" onClick={handlePrint}>
                    <LocalIcon icon="print" />
                  </ActionIcon>
                </Tooltip>

                <Divider orientation="vertical" />

                <Button leftSection={<LocalIcon icon="picture-as-pdf" />} color="blue" variant="filled" onClick={handleConvertToPdf}>
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
                style={{ cursor: 'pointer', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.02)', background: 'var(--mantine-color-gray-0)' } }}
                onClick={() => setCurrentFolder(folder.name)}
              >
                <Group justify="space-between">
                  <Group gap="sm">
                    <LocalIcon icon="folder-rounded" width="2.5rem" height="2.5rem" style={{ color: "var(--mantine-color-blue-6)" }} />
                    <Stack gap={0}>
                      <Text fw={600} size="lg">{folder.name}</Text>
                      <Text size="xs" color="dimmed">{folder.files.length} {t('myFiles.files', 'files')}</Text>
                    </Stack>
                  </Group>
                  <LocalIcon icon="chevron-right" style={{ color: 'var(--mantine-color-gray-5)' }} />
                </Group>
              </Card>
            ))}
            {folders.length === 0 && (
              <Box p="xl" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
                <LocalIcon icon="folder-off" width="4rem" height="4rem" style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <Text color="dimmed">{t('myFiles.noScans', 'No scans yet. Use the camera to start scanning!')}</Text>
              </Box>
            )}
          </SimpleGrid>
        ) : (
          <Stack>
            <Group justify="space-between">
              <Group>
                <Checkbox 
                  label={t('myFiles.selectAll', 'Select All')} 
                  checked={selectedFileIds.size === currentFolderFiles.length && currentFolderFiles.length > 0} 
                  indeterminate={selectedFileIds.size > 0 && selectedFileIds.size < currentFolderFiles.length}
                  onChange={(e) => handleSelectAll(e.currentTarget.checked)}
                />
                <Text size="sm" color="dimmed">{selectedFileIds.size} selected</Text>
              </Group>
              {selectedFileIds.size > 0 && (
                <Button variant="subtle" size="xs" leftSection={<LocalIcon icon="drive-file-move" />} onClick={() => setMoveOpened(true)}>
                  {t('myFiles.moveToFolder', 'Move to Folder')}
                </Button>
              )}
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
                  <Card.Section onClick={() => openPreview(file.id)} style={{ cursor: 'pointer' }}>
                    <Image
                      src={file.thumbnailUrl}
                      height={180}
                      alt={file.name}
                      fallbackSrc="https://placehold.co/180x180?text=Scan"
                      fit="contain"
                      style={{ padding: '4px' }}
                    />
                  </Card.Section>
                  <Box p="xs" onClick={() => openPreview(file.id)} style={{ cursor: 'pointer' }}>
                    <Text size="xs" mt="xs" truncate fw={500}>{file.name}</Text>
                    <Text size="xs" color="dimmed">
                      {(file.size / 1024).toFixed(1)} KB
                    </Text>
                  </Box>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        )}
      </Stack>

      {/* Modals */}
      <EffectsModal 
        opened={effectsOpened} 
        onClose={() => setEffectsOpened(false)} 
        files={selectedFiles}
        onApply={handleApplyEffects}
      />

      <Modal opened={newFolderOpened} onClose={() => setNewFolderOpened(false)} title={t('myFiles.createFolder', 'Create Folder')}>
        <Stack>
          <TextInput 
            label={t('myFiles.folderName', 'Folder Name')} 
            placeholder="e.g. Invoices" 
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.currentTarget.value)}
          />
          <Button disabled={!newFolderName} onClick={() => { setCurrentFolder(newFolderName); setNewFolderOpened(false); }}>
            {t('myFiles.createFolder', 'Create Folder')}
          </Button>
        </Stack>
      </Modal>

      <Modal opened={moveOpened} onClose={() => setMoveOpened(false)} title={t('myFiles.moveToFolder', 'Move to Folder')}>
        <Stack>
          <Select 
            label={t('myFiles.moveToFolder', 'Move to Folder')}
            data={folders.map(f => ({ value: f.name, label: f.name }))}
            value={targetFolder}
            onChange={(v) => setTargetFolder(v || '')}
          />
          <Button disabled={!targetFolder} onClick={handleMoveFiles}>
            {t('myFiles.moveToFolder', 'Move to Folder')}
          </Button>
        </Stack>
      </Modal>

      {previewFile && (
        <FilePreviewModal
          opened={previewOpened}
          onClose={() => setPreviewOpened(false)}
          file={previewFile}
          fileUrl={previewUrl}
          loading={previewLoading}
          onPrev={handlePrevPreview}
          onNext={handleNextPreview}
          actions={{
            onEffects: () => { setPreviewOpened(false); setSelectedFileIds(new Set([previewFile.id])); setEffectsOpened(true); },
            onShare: handleShare,
            onPrint: handlePrint,
            onDelete: handleDelete
          }}
        />
      )}
    </Box>
  );
}
