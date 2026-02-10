import { useState, useCallback } from 'react';
import { BaseParametersHook } from '@app/hooks/tools/shared/useBaseParameters';

export interface ScannerEffectParameters {
  brightness: number;
  contrast: number;
  blur: number;
  noise: number;
  yellowish: boolean;
  renderResolution: number;
  colorspace: 'color' | 'grayscale' | 'black_white';
  autoCrop: boolean;
  scannyFilter: 'none' | 'magic_color' | 'black_white';
  googleDriveSync: boolean;
}

const INITIAL_PARAMETERS: ScannerEffectParameters = {
  brightness: 0,
  contrast: 1,
  blur: 0.5,
  noise: 0.2,
  yellowish: false,
  renderResolution: 200,
  colorspace: 'color',
  autoCrop: false,
  scannyFilter: 'none',
  googleDriveSync: false,
};

export function useScannerEffectParameters(): BaseParametersHook<ScannerEffectParameters> {
  const [parameters, setParameters] = useState<ScannerEffectParameters>(INITIAL_PARAMETERS);

  const updateParameter = useCallback((key: keyof ScannerEffectParameters, value: any) => {
    setParameters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetParameters = useCallback(() => {
    setParameters(INITIAL_PARAMETERS);
  }, []);

  const getEndpointName = useCallback(() => 'scanner-effect', []);

  return {
    parameters,
    updateParameter,
    resetParameters,
    getEndpointName,
  };
}
