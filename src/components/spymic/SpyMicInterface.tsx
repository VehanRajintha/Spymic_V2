"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import AppLogo from '@/components/icons/AppLogo';
import { Bluetooth, Mic, MicOff, Play, Pause, Volume2, VolumeX, Power, AlertTriangle } from 'lucide-react';

type MicAccessState = 'idle' | 'requesting' | 'granted' | 'denied';

export default function SpyMicInterface() {
  const [micAccessState, setMicAccessState] = useState<MicAccessState>('idle');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.5); // Volume 0 to 1

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const { toast } = useToast();

  const cleanupAudio = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error("Error closing AudioContext:", e));
      audioContextRef.current = null;
    }
    console.log("Audio resources cleaned up.");
  }, []);

  const initializeAudio = async () => {
    if (micAccessState !== 'requesting') return;

    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      console.log("Microphone access granted.");

      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = context;
      console.log("AudioContext created.");

      const source = context.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      console.log("MediaStreamSource created.");

      const gain = context.createGain();
      gainNodeRef.current = gain;
      console.log("GainNode created.");

      source.connect(gain);
      gain.connect(context.destination);
      console.log("Audio graph connected: source -> gain -> destination.");
      
      gain.gain.setValueAtTime(volume, context.currentTime);
      setMicAccessState('granted');
      setIsPlaying(true); // Auto-play on connect
      toast({ title: "SpyMic Activated", description: "Microphone connected and audio is live." });

    } catch (error) {
      console.error("Error accessing microphone or setting up audio:", error);
      setMicAccessState('denied');
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not access microphone. Please check permissions.",
      });
      cleanupAudio();
    }
  };

  const handleActivateToggle = () => {
    if (micAccessState === 'idle' || micAccessState === 'denied') {
      setMicAccessState('requesting');
      // initializeAudio will be called by useEffect when micAccessState becomes 'requesting'
    } else if (micAccessState === 'granted') {
      console.log("Deactivating SpyMic...");
      cleanupAudio();
      setMicAccessState('idle');
      setIsPlaying(false);
      toast({ title: "SpyMic Deactivated", description: "Microphone disconnected." });
    }
  };
  
  useEffect(() => {
    if (micAccessState === 'requesting') {
      initializeAudio();
    }
    // Ensure cleanup when component unmounts or micAccessState changes away from granted
    return () => {
      if (micAccessState !== 'granted' && micAccessState !== 'requesting') {
         // cleanupAudio(); // This might be too aggressive. Let handleActivateToggle manage cleanup.
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micAccessState]); // Removed initializeAudio, cleanupAudio from deps to avoid infinite loops. Logic managed by state changes.


  useEffect(() => {
    // Cleanup on unmount
    return () => {
      console.log("SpyMicInterface unmounting. Cleaning up audio resources...");
      cleanupAudio();
    };
  }, [cleanupAudio]);

  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      const newGainValue = isPlaying ? volume : 0;
      gainNodeRef.current.gain.setValueAtTime(newGainValue, audioContextRef.current.currentTime);
      console.log(`Gain updated: isPlaying=${isPlaying}, volume=${volume}, gainValue=${newGainValue}`);
    }
  }, [isPlaying, volume, micAccessState]);

  const handlePlayPauseToggle = () => {
    if (micAccessState === 'granted') {
      setIsPlaying(prev => !prev);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    setVolume(newVolume[0]);
  };

  const getStatusText = () => {
    if (micAccessState === 'denied') return "Mic access denied. Check permissions.";
    if (micAccessState === 'requesting') return "Connecting to microphone...";
    if (micAccessState === 'granted') {
      return isPlaying ? "Listening via Mic" : "Paused - Mic Active";
    }
    return "Inactive";
  };

  const isControlDisabled = micAccessState !== 'granted';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
      <Card className="w-full max-w-md shadow-2xl" style={{boxShadow: '0 10px 25px -5px hsl(var(--primary) / 0.3), 0 8px 10px -6px hsl(var(--primary) / 0.2)'}}>
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <AppLogo className="w-12 h-12 mr-3 text-primary" />
            <CardTitle className="text-4xl font-headline">SpyMic</CardTitle>
          </div>
          <CardDescription className="text-lg">
            Listen to your phone's mic via earbuds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center p-3 rounded-lg bg-card-foreground/5 text-foreground">
            {micAccessState === 'granted' && isPlaying && <Mic className="w-5 h-5 mr-2 text-green-400 animate-pulse" />}
            {micAccessState === 'granted' && !isPlaying && <MicOff className="w-5 h-5 mr-2 text-yellow-400" />}
            {micAccessState === 'denied' && <AlertTriangle className="w-5 h-5 mr-2 text-red-400" />}
            {(micAccessState === 'idle' || micAccessState === 'requesting') && <Bluetooth className="w-5 h-5 mr-2 text-primary" />}
            <span className="font-medium">{getStatusText()}</span>
          </div>

          <Button
            onClick={handleActivateToggle}
            className="w-full text-lg py-6 transition-all duration-300 ease-in-out transform hover:scale-105"
            variant={micAccessState === 'granted' ? "destructive" : "default"}
          >
            {micAccessState === 'granted' ? <Power className="w-5 h-5 mr-2" /> : <Bluetooth className="w-5 h-5 mr-2" />}
            {micAccessState === 'granted' ? 'Deactivate SpyMic' : 'Activate SpyMic'}
          </Button>

          <div className="space-y-4">
            <Button
              onClick={handlePlayPauseToggle}
              disabled={isControlDisabled}
              className="w-full text-lg py-6 transition-all duration-300 ease-in-out"
              variant="secondary"
            >
              {isPlaying ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
              {isPlaying ? 'Pause Listening' : 'Start Listening'}
            </Button>

            <div className="space-y-2">
              <label htmlFor="volume-slider" className="block text-sm font-medium text-muted-foreground">
                Volume Control
              </label>
              <div className="flex items-center space-x-3">
                <VolumeX className={`w-6 h-6 ${isControlDisabled ? 'text-muted-foreground/50' : 'text-accent'}`} />
                <Slider
                  id="volume-slider"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[volume]}
                  onValueChange={handleVolumeChange}
                  disabled={isControlDisabled}
                  className="flex-grow"
                  aria-label="Volume control"
                />
                <Volume2 className={`w-6 h-6 ${isControlDisabled ? 'text-muted-foreground/50' : 'text-accent'}`} />
              </div>
               <p className="text-xs text-center text-muted-foreground">Volume: {Math.round(volume * 100)}%</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-xs text-muted-foreground">
            Ensure your Bluetooth earbuds are connected to this device.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
