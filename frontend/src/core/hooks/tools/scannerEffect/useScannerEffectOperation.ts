import { useToolOperation, ToolOperationHook, ToolType, ToolOperationConfig } from '@app/hooks/tools/shared/useToolOperation';
import { ScannerEffectParameters } from '@app/hooks/tools/scannerEffect/useScannerEffectParameters';
import { ToolId } from '@app/types/toolId';

export type ScannerEffectOperationHook = ToolOperationHook<ScannerEffectParameters>;

export const buildScannerEffectFormData = (parameters: ScannerEffectParameters, file: File): FormData => {
    const formData = new FormData();
    formData.append('fileInput', file);
    formData.append('brightness', parameters.brightness.toString());
    formData.append('contrast', parameters.contrast.toString());
    formData.append('blur', parameters.blur.toString());
    formData.append('noise', parameters.noise.toString());
    formData.append('yellowish', parameters.yellowish.toString());
    formData.append('renderResolution', parameters.renderResolution.toString());
    formData.append('colorspace', parameters.colorspace);
    formData.append('autoCrop', parameters.autoCrop.toString());
    formData.append('scannyFilter', parameters.scannyFilter);
    formData.append('googleDriveSync', parameters.googleDriveSync.toString());
    return formData;
};

export const scannerEffectOperationConfig = {
    endpoint: 'misc/scanner-effect',
    method: 'POST',
    toolType: ToolType.singleFile,
    operationType: 'scannerEffect' as ToolId,
    buildFormData: buildScannerEffectFormData,
} as const;

export const useScannerEffectOperation = (): ScannerEffectOperationHook => {
    return useToolOperation<ScannerEffectParameters>(scannerEffectOperationConfig as unknown as ToolOperationConfig<ScannerEffectParameters>);
};
