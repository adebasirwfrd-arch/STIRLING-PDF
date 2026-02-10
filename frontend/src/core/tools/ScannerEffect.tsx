import { useTranslation } from 'react-i18next';
import { createToolFlow } from '@app/components/tools/shared/createToolFlow';
import { BaseToolProps, ToolComponent } from '@app/types/tool';
import { useBaseTool } from '@app/hooks/tools/shared/useBaseTool';
import { useScannerEffectParameters } from '@app/hooks/tools/scannerEffect/useScannerEffectParameters';
import { useScannerEffectOperation } from '@app/hooks/tools/scannerEffect/useScannerEffectOperation';
import { Stack, Slider, Text, Switch, Group, Select, NumberInput } from '@mantine/core';

const ScannerEffect = (props: BaseToolProps) => {
  const { t } = useTranslation();

  const base = useBaseTool(
    'scannerEffect',
    useScannerEffectParameters,
    useScannerEffectOperation,
    props
  );

  const { parameters, updateParameter } = base.params;

  return createToolFlow({
    files: {
      selectedFiles: base.selectedFiles,
      isCollapsed: base.hasResults,
    },
    steps: [
      {
        title: t('scannerEffect.settings', 'Scanner Settings'),
        content: (
          <Stack gap="md">
            <Group grow>
              <Stack gap={4}>
                <Text size="sm">{t('scannerEffect.brightness', 'Brightness')}</Text>
                <Slider
                  value={parameters.brightness}
                  onChange={(v) => updateParameter('brightness', v)}
                  min={-1}
                  max={1}
                  step={0.1}
                />
              </Stack>
              <Stack gap={4}>
                <Text size="sm">{t('scannerEffect.contrast', 'Contrast')}</Text>
                <Slider
                  value={parameters.contrast}
                  onChange={(v) => updateParameter('contrast', v)}
                  min={0}
                  max={2}
                  step={0.1}
                />
              </Stack>
            </Group>

            <Group grow>
              <Stack gap={4}>
                <Text size="sm">{t('scannerEffect.blur', 'Blur')}</Text>
                <Slider
                  value={parameters.blur}
                  onChange={(v) => updateParameter('blur', v)}
                  min={0}
                  max={5}
                  step={0.1}
                />
              </Stack>
              <Stack gap={4}>
                <Text size="sm">{t('scannerEffect.noise', 'Noise')}</Text>
                <Slider
                  value={parameters.noise}
                  onChange={(v) => updateParameter('noise', v)}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </Stack>
            </Group>

            <Group grow>
              <Select
                label={t('scannerEffect.colorspace', 'Colorspace')}
                value={parameters.colorspace}
                onChange={(v) => updateParameter('colorspace', v as "color" | "grayscale" | "black_white")}
                data={[
                  { value: 'color', label: t('scannerEffect.color', 'Color') },
                  { value: 'grayscale', label: t('scannerEffect.grayscale', 'Grayscale') },
                  { value: 'black_white', label: t('scannerEffect.blackWhite', 'Black & White') },
                ]}
              />
              <NumberInput
                label={t('scannerEffect.resolution', 'Resolution (DPI)')}
                value={parameters.renderResolution}
                onChange={(v) => updateParameter('renderResolution', Number(v))}
                min={72}
                max={600}
              />
            </Group>

            <Switch
                label={t('scannerEffect.yellowish', 'Add yellowish tint')}
                checked={parameters.yellowish}
                onChange={(e) => updateParameter('yellowish', e.currentTarget.checked)}
            />
          </Stack>
        ),
      },
      {
        title: t('scannerEffect.advanced', 'Advanced Features (Scanny)'),
        content: (
          <Stack gap="md">
            <Switch
              label={t('scannerEffect.autoCrop', 'Auto-Crop (Perspective Correction)')}
              checked={parameters.autoCrop}
              onChange={(e) => updateParameter('autoCrop', e.currentTarget.checked)}
            />
            <Select
              label={t('scannerEffect.scannyFilter', 'Enhanced Filters')}
              value={parameters.scannyFilter}
              onChange={(v) => updateParameter('scannyFilter', v as "black_white" | "none" | "magic_color")}
              data={[
                { value: 'none', label: t('scannerEffect.filterNone', 'None') },
                { value: 'magic_color', label: t('scannerEffect.filterMagic', 'Magic Color') },
                { value: 'black_white', label: t('scannerEffect.filterBW', 'Enhanced B&W') },
              ]}
            />
          </Stack>
        ),
      },
      {
        title: t('scannerEffect.cloudSync', 'Cloud Sync'),
        content: (
          <Stack gap="md">
            <Switch
              label={t('scannerEffect.googleDriveSync', 'Sync to Google Drive')}
              description={t('scannerEffect.googleDriveSyncDesc', 'Automatically upload the processed file to Google Drive')}
              checked={parameters.googleDriveSync}
              onChange={(e) => updateParameter('googleDriveSync', e.currentTarget.checked)}
            />
          </Stack>
        ),
      }
    ],
    executeButton: {
      text: t('scannerEffect.apply', 'Apply Scanner Effect'),
      isVisible: !base.hasResults,
      loadingText: t('loading'),
      onClick: base.handleExecute,
      disabled: !base.hasFiles,
    },
    review: {
      isVisible: base.hasResults,
      operation: base.operation,
      title: t('scannerEffect.results', 'Processed PDF'),
      onFileClick: base.handleThumbnailClick,
      onUndo: base.handleUndo,
    },
  });
};

export default ScannerEffect as ToolComponent;
