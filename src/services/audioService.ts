class AudioService {
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initializeAudioContext();
  }

  private async initializeAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
    }
  }

  private async ensureAudioContext() {
    if (!this.audioContext) {
      await this.initializeAudioContext();
    }
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private createTone(frequency: number, duration: number, volume: number = 0.3): void {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  public async playTaskNotification() {
    await this.ensureAudioContext();
    // High-pitched, quick beep for tasks
    this.createTone(800, 0.2, 0.3);
    setTimeout(() => this.createTone(1000, 0.2, 0.3), 100);
  }

  public async playScheduleNotification() {
    await this.ensureAudioContext();
    // Medium-pitched, longer tone for schedules
    this.createTone(600, 0.4, 0.3);
    setTimeout(() => this.createTone(700, 0.4, 0.3), 200);
  }

  public async playAssignmentNotification() {
    await this.ensureAudioContext();
    // Low-pitched, rhythmic pattern for assignments
    this.createTone(400, 0.15, 0.3);
    setTimeout(() => this.createTone(400, 0.15, 0.3), 200);
    setTimeout(() => this.createTone(500, 0.3, 0.3), 400);
  }

  public async playTestSound(type: 'task' | 'schedule' | 'assignment' = 'task') {
    switch (type) {
      case 'task':
        await this.playTaskNotification();
        break;
      case 'schedule':
        await this.playScheduleNotification();
        break;
      case 'assignment':
        await this.playAssignmentNotification();
        break;
    }
  }
}

export const audioService = new AudioService();
