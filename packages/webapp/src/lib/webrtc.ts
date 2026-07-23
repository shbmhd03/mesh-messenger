/**
 * WebRTCManager: Manages P2P WebRTC audio and video streaming.
 * Handles local media capture (mic/camera), SDP negotiation, and ICE candidate exchange.
 */

export type CallType = 'voice' | 'video';

export interface WebRTCEvents {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (error: Error) => void;
}

const STUN_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private events: WebRTCEvents;
  private queuedIceCandidates: RTCIceCandidateInit[] = [];

  constructor(events: WebRTCEvents) {
    this.events = events;
  }

  /**
   * Acquire local media stream (microphone and/or camera)
   */
  public async getLocalStream(callType: CallType): Promise<MediaStream> {
    if (this.localStream) {
      return this.localStream;
    }

    const constraints: MediaStreamConstraints = {
      audio: true,
      video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.localStream;
    } catch (err: any) {
      // Fallback if video is rejected or unavailable: attempt audio-only
      if (callType === 'video') {
        try {
          this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          return this.localStream;
        } catch (audioErr: any) {
          throw new Error('Microphone and camera access denied.');
        }
      }
      throw new Error('Microphone access denied.');
    }
  }

  /**
   * Initialize RTCPeerConnection instance
   */
  private initPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      return this.pc;
    }

    const pc = new RTCPeerConnection(STUN_SERVERS);
    this.pc = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.events.onIceCandidate(event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      let targetStream: MediaStream;
      if (event.streams && event.streams[0]) {
        targetStream = event.streams[0];
        this.remoteStream = targetStream;
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
        targetStream = this.remoteStream;
      }
      // Emit a fresh MediaStream instance clone so React detects stream changes & re-renders video/audio elements
      this.events.onRemoteStream(new MediaStream(targetStream.getTracks()));
    };

    pc.onconnectionstatechange = () => {
      this.events.onConnectionStateChange(pc.connectionState);
    };

    return pc;
  }

  /**
   * Caller: Create SDP Offer for outgoing call
   */
  public async createOffer(callType: CallType): Promise<RTCSessionDescriptionInit> {
    const pc = this.initPeerConnection();
    const stream = await this.getLocalStream(callType);

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video',
    });

    await pc.setLocalDescription(offer);
    return offer;
  }

  /**
   * Callee: Handle SDP Offer & Create SDP Answer for incoming call
   */
  public async createAnswer(offerSdp: RTCSessionDescriptionInit, callType: CallType): Promise<RTCSessionDescriptionInit> {
    const pc = this.initPeerConnection();
    const stream = await this.getLocalStream(callType);

    // Add local tracks BEFORE setRemoteDescription so tracks are negotiated in the SDP answer
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    await this.flushQueuedIceCandidates();

    const answer = await pc.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === 'video',
    });
    await pc.setLocalDescription(answer);
    return answer;
  }

  /**
   * Caller: Handle SDP Answer from callee
   */
  public async handleAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
    await this.flushQueuedIceCandidates();
  }

  /**
   * Add ICE candidate received via signaling (queues candidate if remoteDescription is not ready)
   */
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) {
      this.queuedIceCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('[WebRTC] Error adding ICE candidate:', e);
    }
  }

  /**
   * Flush all ICE candidates that arrived before remoteDescription was set
   */
  private async flushQueuedIceCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;
    const candidatesToFlush = [...this.queuedIceCandidates];
    this.queuedIceCandidates = [];
    for (const candidate of candidatesToFlush) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('[WebRTC] Error adding queued ICE candidate:', e);
      }
    }
  }

  /**
   * Toggle local microphone mute
   */
  public toggleMute(muted: boolean): boolean {
    if (!this.localStream) return false;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    return muted;
  }

  /**
   * Toggle local camera stream
   */
  public toggleCamera(cameraOff: boolean): boolean {
    if (!this.localStream) return false;
    this.localStream.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
    return cameraOff;
  }

  /**
   * Stop all local tracks and close WebRTC peer connection
   */
  public close(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
  }
}
