import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Stack, Button, Box, Text, Group, ActionIcon, Switch, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import LocalIcon from '@app/components/shared/LocalIcon';
import { Z_INDEX_OVER_FILE_MANAGER_MODAL } from '@app/styles/zIndex';
import { TextInput } from '@mantine/core';
import { createStirlingFile, createNewStirlingFileStub } from '@app/types/fileContext';
import { fileStorage } from '@app/services/fileStorage';

interface CameraCaptureModalProps {
  opened: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

// Detection resolution - low for performance
const DETECTION_WIDTH = 320;

export default function CameraCaptureModal({ opened, onClose, onCapture }: CameraCaptureModalProps) {
  const { t } = useTranslation();
  const [loadingStatus, setLoadingStatus] = useState<string>(t('camera.initializing', 'Initializing camera...'));
  const [cameraReady, setCameraReady] = useState(false);
  const [autoCrop, setAutoCrop] = useState(true);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [folderName, setFolderName] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const highlightCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerRef = useRef<any>(null);
  const highlightFrameRef = useRef<number | null>(null);

  // Initialize camera
  useEffect(() => {
    if (opened && !capturedImage) {
      setCameraReady(false);
      setLoadingStatus(t('camera.initializing', 'Initializing camera...'));

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setLoadingStatus(t('camera.cameraAccessError', 'Camera access denied or not available.'));
        return;
      }

      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        })
        .then(async (stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              setCameraReady(true);
              setLoadingStatus(t('camera.ready', 'Camera ready!'));
            };

            // Check capabilities for torch
            const videoTrack = stream.getVideoTracks()[0];
            const capabilities = videoTrack.getCapabilities() as any;
            if (capabilities.torch) {
              setTorchSupported(true);
            }
          }
        })
        .catch((err) => {
          console.error('Camera error:', err);
          setLoadingStatus(t('camera.cameraAccessError', 'Camera access denied or not available.'));
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (highlightFrameRef.current) {
        cancelAnimationFrame(highlightFrameRef.current);
      }
    };
  }, [opened, capturedImage, t]);

  // Document detection loop
  useEffect(() => {
    if (opened && cameraReady && autoCrop && !capturedImage && window.jscanify && window.cv) {
      if (!scannerRef.current) {
        scannerRef.current = new window.jscanify();
      }

      const video = videoRef.current;
      const highlightCanvas = highlightCanvasRef.current;
      if (!video || !highlightCanvas) return;

      const detectionCanvas = document.createElement('canvas');
      const detectionCtx = detectionCanvas.getContext('2d', { willReadFrequently: true });
      if (!detectionCtx) return;

      const runDetection = () => {
        if (!video.videoWidth) {
          highlightFrameRef.current = requestAnimationFrame(runDetection);
          return;
        }

        const scale = DETECTION_WIDTH / video.videoWidth;
        detectionCanvas.width = DETECTION_WIDTH;
        detectionCanvas.height = video.videoHeight * scale;
        
        highlightCanvas.width = video.videoWidth;
        highlightCanvas.height = video.videoHeight;
        const highlightCtx = highlightCanvas.getContext('2d');
        if (!highlightCtx) return;

        detectionCtx.drawImage(video, 0, 0, detectionCanvas.width, detectionCanvas.height);
        
        try {
          const mat = window.cv.imread(detectionCanvas);
          const contour = scannerRef.current.findPaperContour(mat);
          mat.delete();

          highlightCtx.clearRect(0, 0, highlightCanvas.width, highlightCanvas.height);

          if (contour) {
            const corners = scannerRef.current.getCornerPoints(contour);
            if (corners) {
              const scaleFactor = 1 / scale;
              const points = [
                { x: corners.topLeftCorner.x * scaleFactor, y: corners.topLeftCorner.y * scaleFactor },
                { x: corners.topRightCorner.x * scaleFactor, y: corners.topRightCorner.y * scaleFactor },
                { x: corners.bottomRightCorner.x * scaleFactor, y: corners.bottomRightCorner.y * scaleFactor },
                { x: corners.bottomLeftCorner.x * scaleFactor, y: corners.bottomLeftCorner.y * scaleFactor },
              ];

              highlightCtx.strokeStyle = '#00FF00';
              highlightCtx.lineWidth = 6;
              highlightCtx.beginPath();
              highlightCtx.moveTo(points[0].x, points[0].y);
              points.forEach((p, i) => i > 0 && highlightCtx.lineTo(p.x, p.y));
              highlightCtx.closePath();
              highlightCtx.stroke();
            }
          }
        } catch (e) {
          console.error('Detection error', e);
        }

        highlightFrameRef.current = requestAnimationFrame(runDetection);
      };

      highlightFrameRef.current = requestAnimationFrame(runDetection);

      return () => {
        if (highlightFrameRef.current) cancelAnimationFrame(highlightFrameRef.current);
      };
    }
  }, [opened, cameraReady, autoCrop, capturedImage]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (track && torchSupported) {
      try {
        await (track as any).applyConstraints({ advanced: [{ torch: !torchEnabled }] });
        setTorchEnabled(!torchEnabled);
      } catch (e) {
        console.error('Torch error', e);
      }
    }
  };

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    if (autoCrop && scannerRef.current && window.cv) {
      try {
        const mat = window.cv.imread(canvas);
        const contour = scannerRef.current.findPaperContour(mat);
        if (contour) {
          const resultCanvas = scannerRef.current.extractPaper(canvas, 1080, 1528); // Standard ratio
          setCapturedImage(resultCanvas.toDataURL('image/jpeg', 0.9));
        } else {
          setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
        }
        mat.delete();
      } catch (e) {
        setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
      }
    } else {
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
    }
    setIsProcessing(false);
  };

  const handleDone = async () => {
    if (!capturedImage) return;
    const response = await fetch(capturedImage);
    const blob = await response.blob();
    const fileName = `scan-${Date.now()}.jpg`;
    const file = new File([blob], fileName, { type: 'image/jpeg' });
    
    // Generate a small thumbnail for the grid view
    let thumbnail: string | undefined;
    try {
      const thumbCanvas = document.createElement('canvas');
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = capturedImage;
        });
        const scale = 200 / Math.max(img.width, img.height);
        thumbCanvas.width = img.width * scale;
        thumbCanvas.height = img.height * scale;
        thumbCtx.drawImage(img, 0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);
      }
    } catch (e) {
      console.warn('Failed to generate thumbnail:', e);
    }

    // Create StirlingFile and Stub with folder/tags
    const stirlingFile = createStirlingFile(file);
    const stub = createNewStirlingFileStub(file, stirlingFile.fileId, thumbnail);
    stub.folder = folderName.trim() || t('camera.defaultFolder', 'Scans');
    stub.tags = ['scan'];

    // Persist to storage for "My Files" access
    try {
      await fileStorage.storeStirlingFile(stirlingFile, stub);
    } catch (error) {
      console.error('Failed to persist scan:', error);
    }

    onCapture(stirlingFile);
    onClose();
    setCapturedImage(null);
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t('camera.title', 'Camera Scan')}
      size="xl"
      padding={0}
      zIndex={Z_INDEX_OVER_FILE_MANAGER_MODAL}
      styles={{
        header: {
          padding: '1rem',
          marginBottom: 0,
        },
        body: {
          padding: 0,
          background: '#000',
        }
      }}
    >
      <Stack gap={0} style={{ position: 'relative', height: '70vh', overflow: 'hidden' }}>
        {!capturedImage ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <canvas
              ref={highlightCanvasRef}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            />
            
            <Box style={{ position: 'absolute', top: '1rem', left: '1rem', right: '1rem', zIndex: 10 }}>
              <Group justify="space-between">
                <Switch
                  label={t('camera.autoCrop', 'Auto-Crop')}
                  checked={autoCrop}
                  onChange={(e) => setAutoCrop(e.currentTarget.checked)}
                  styles={{ label: { color: '#fff' } }}
                />
                <TextInput
                  placeholder={t('camera.folderPlaceholder', 'Enter folder name...')}
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                  size="xs"
                  styles={{
                    input: {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                      width: '150px'
                    }
                  }}
                />
                {torchSupported && (
                  <ActionIcon variant="filled" color="yellow" onClick={toggleTorch} size="lg">
                    <LocalIcon icon={torchEnabled ? "flash-on-rounded" : "flash-off-rounded"} />
                  </ActionIcon>
                )}
              </Group>
            </Box>

            <Box
              style={{
                position: 'absolute',
                bottom: '2rem',
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                zIndex: 10
              }}
            >
              <ActionIcon
                onClick={capture}
                disabled={!cameraReady || isProcessing}
                size={80}
                radius={80}
                variant="filled"
                color="blue"
                style={{ border: '4px solid #fff', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
              >
                {isProcessing ? <Loader size="md" color="white" /> : <LocalIcon icon="photo-camera-rounded" width="2.5rem" height="2.5rem" />}
              </ActionIcon>
            </Box>
          </>
        ) : (
          <Box style={{ width: '100%', height: '100%', position: 'relative' }}>
            <img
              src={capturedImage}
              alt="Captured"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <Box
              style={{
                position: 'absolute',
                bottom: '2rem',
                left: 0,
                right: 0,
                padding: '0 2rem'
              }}
            >
              <Group grow gap="md">
                <Button variant="outline" color="gray" leftSection={<LocalIcon icon="refresh" />} onClick={() => setCapturedImage(null)}>
                  {t('camera.retake', 'Retake')}
                </Button>
                <Button variant="filled" color="green" leftSection={<LocalIcon icon="check" />} onClick={handleDone}>
                  {t('camera.addFile', 'Add to Files')}
                </Button>
              </Group>
            </Box>
          </Box>
        )}
      </Stack>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Modal>
  );
}
