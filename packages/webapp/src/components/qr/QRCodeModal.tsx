/**
 * QRCodeModal — Displays owner's Node ID QR Code and provides camera / image file QR scanner.
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { useMeshStore } from '../../store/meshStore';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QRCodeModal({ isOpen, onClose }: QRCodeModalProps) {
  const { ownNodeId, ownDisplayName, connectToPeerById } = useMeshStore();
  const [activeTab, setActiveTab] = useState<'my_qr' | 'scan'>('my_qr');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Generate QR Code data URL when tab opens
  useEffect(() => {
    if (isOpen && activeTab === 'my_qr') {
      const inviteUrl = `${window.location.origin}/?peer=${ownNodeId}`;
      QRCode.toDataURL(inviteUrl, { width: 300, margin: 2, color: { dark: '#ffffff', light: '#0c0c18' } })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR:', err));
    }
  }, [isOpen, activeTab, ownNodeId]);

  // Handle camera video stream for QR scanning
  useEffect(() => {
    if (isOpen && activeTab === 'scan') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    setScanError(null);
    setScanResult(null);
    setScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        videoRef.current.play();
        animationFrameRef.current = requestAnimationFrame(scanTick);
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setScanError('Camera permission denied or camera unavailable. Try uploading a QR image.');
      setScanning(false);
    }
  };

  const stopCamera = () => {
    setScanning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const scanTick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleDetectedCode(code.data);
          return;
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(scanTick);
  };

  const handleDetectedCode = (rawCode: string) => {
    let peerId = rawCode.trim();
    if (peerId.includes('peer=')) {
      const match = peerId.match(/peer=([A-Za-z0-9]+)/i);
      if (match && match[1]) {
        peerId = match[1];
      }
    }

    peerId = peerId.toUpperCase();
    if (peerId.length >= 4) {
      setScanResult(peerId);
      stopCamera();
      const success = connectToPeerById(peerId);
      if (success) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } else {
      setScanError(`Invalid QR Code content: ${rawCode}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code && code.data) {
            handleDetectedCode(code.data);
          } else {
            setScanError('No valid QR code detected in uploaded image.');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const copyInviteLink = () => {
    const inviteUrl = `${window.location.origin}/?peer=${ownNodeId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>QR Code & Scanner</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="qr-tab-nav">
          <button
            className={`qr-tab ${activeTab === 'my_qr' ? 'active' : ''}`}
            onClick={() => setActiveTab('my_qr')}
          >
            My QR Code
          </button>
          <button
            className={`qr-tab ${activeTab === 'scan' ? 'active' : ''}`}
            onClick={() => setActiveTab('scan')}
          >
            Scan Peer QR
          </button>
        </div>

        <div className="qr-body">
          {activeTab === 'my_qr' ? (
            <div className="my-qr-container">
              <div className="qr-card">
                <div className="qr-user-title">{ownDisplayName}</div>
                <div className="qr-user-node">Node ID: <code>{ownNodeId}</code></div>

                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Mesh QR Code" className="qr-image" />
                ) : (
                  <div className="qr-placeholder">Generating QR...</div>
                )}
                <div className="qr-hint">Scan with any smartphone or Mesh app to connect instantly.</div>
              </div>

              <div className="qr-actions">
                <button className="qr-action-btn primary" onClick={copyInviteLink}>
                  {copied ? '✓ Link Copied!' : 'Copy Invite Link'}
                </button>
                {qrDataUrl && (
                  <a href={qrDataUrl} download={`mesh-qr-${ownNodeId}.png`} className="qr-action-btn secondary">
                    Download Image
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="scan-qr-container">
              <div className="camera-viewfinder">
                <video ref={videoRef} className="camera-video" />
                {scanning && (
                  <div className="viewfinder-frame">
                    <div className="viewfinder-corner top-left"></div>
                    <div className="viewfinder-corner top-right"></div>
                    <div className="viewfinder-corner bottom-left"></div>
                    <div className="viewfinder-corner bottom-right"></div>
                    <div className="laser-line"></div>
                  </div>
                )}
              </div>

              {scanResult && (
                <div className="scan-success-banner">
                  ✓ Successfully connected to peer <code>{scanResult}</code>!
                </div>
              )}

              {scanError && (
                <div className="scan-error-banner">
                  {scanError}
                </div>
              )}

              <div className="scan-file-upload">
                <label htmlFor="qr-file-input" className="file-upload-btn">
                  📷 Upload QR Image
                </label>
                <input
                  id="qr-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
