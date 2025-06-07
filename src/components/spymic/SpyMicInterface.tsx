
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import AppLogo from '@/components/icons/AppLogo';
import { Bluetooth, Mic, MicOff, Play, Pause, Volume2, VolumeX, Power, AlertTriangle, ShieldCheck, SlidersHorizontal, ArrowRight, SkipForward } from 'lucide-react';

type MicAccessState = 'idle' | 'requesting' | 'granted' | 'denied';

interface Instruction {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
}

const instructionsList: Instruction[] = [
  {
    id: 1,
    title: "Connect Earbuds",
    description: "Ensure your Bluetooth earbuds are paired and connected to your device.",
    icon: Bluetooth,
  },
  {
    id: 2,
    title: "Grant Permissions",
    description: "If prompted, allow microphone access for the app to work correctly.",
    icon: ShieldCheck,
  },
  {
    id: 3,
    title: "Activate SpyMic",
    description: "Tap 'Activate SpyMic' to enable your phone's microphone.",
    icon: Power,
  },
  {
    id: 4,
    title: "Adjust & Listen",
    description: "Use 'Play/Pause' for audio control and the slider to set volume.",
    icon: SlidersHorizontal,
  },
];

export default function SpyMicInterface() {
  const [micAccessState, setMicAccessState] = useState<MicAccessState>('idle');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.5);
  const [currentInstructionStep, setCurrentInstructionStep] = useState<number>(0);
  const [instructionsCompleted, setInstructionsCompleted] = useState<boolean>(false);
  const [animationKey, setAnimationKey] = useState<number>(0); // For re-triggering animation

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

  const initializeAudio = useCallback(async () => {
    if (micAccessState !== 'requesting') {
      console.log("initializeAudio called but micAccessState is not 'requesting'. Current state:", micAccessState);
      return;
    }

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
      setIsPlaying(true);
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
  }, [micAccessState, volume, toast, cleanupAudio]); 

  const handleActivateToggle = () => {
    if (micAccessState === 'idle' || micAccessState === 'denied') {
      setMicAccessState('requesting');
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
  }, [micAccessState, initializeAudio]);

  useEffect(() => {
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
  }, [isPlaying, volume]);

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

  const handleNextInstruction = () => {
    setAnimationKey(prev => prev + 1); 
    if (currentInstructionStep < instructionsList.length - 1) {
      setCurrentInstructionStep(prev => prev + 1);
    } else {
      setInstructionsCompleted(true);
    }
  };

  const handleSkipInstructions = () => {
    setInstructionsCompleted(true);
  };

  const isControlDisabled = micAccessState !== 'granted';

  if (!instructionsCompleted) {
    const instruction = instructionsList[currentInstructionStep];
    const isLastStep = currentInstructionStep === instructionsList.length - 1;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground overflow-hidden">
        <div className="w-full max-w-md mb-8 space-y-4">
          <h2 className="text-3xl font-bold text-center text-primary tracking-tight">How to Use SpyMic</h2>
          <div className="relative"> 
            <style jsx>{`
              @keyframes slide-in-right {
                0% {
                  opacity: 0;
                  transform: translateX(100%);
                }
                100% {
                  opacity: 1;
                  transform: translateX(0);
                }
              }
              .animate-slide-in-right {
                animation: slide-in-right 0.5s ease-out forwards;
              }
              @keyframes pulse-icon {
                0%, 100% {
                  transform: scale(1);
                }
                50% {
                  transform: scale(1.1);
                }
              }
              .animate-pulse-icon {
                animation: pulse-icon 1.5s infinite ease-in-out;
              }
            `}</style>
            <Card
              key={`${instruction.id}-${animationKey}`} 
              className="shadow-lg border-border hover:shadow-xl animate-slide-in-right"
            >
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <instruction.icon className="w-7 h-7 mr-3 text-primary animate-pulse-icon" />
                  {instruction.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{instruction.description}</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="w-full max-w-md flex space-x-4">
          <Button onClick={handleSkipInstructions} variant="outline" className="w-1/3">
            <SkipForward className="mr-2 h-4 w-4" /> Skip
          </Button>
          <Button onClick={handleNextInstruction} className="w-2/3">
            {isLastStep ? 'Get Started' : 'Next'} <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
        <div className="w-full max-w-md mt-4 flex justify-center space-x-2">
            {instructionsList.map((_, index) => (
              <div
                key={`dot-${index}`}
                className={`h-2 w-2 rounded-full ${
                  index === currentInstructionStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
      </div>
    );
  }

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
