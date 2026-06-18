"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Camera,
  Link2,
  Loader2,
  QrCode,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEMO_QUICK_PICKS,
  runDemoAnalysis,
  simulateDemoDelay,
} from "@/lib/ai/demo";
import { persistDemoAnalysis } from "@/lib/ai/demo-session";
import {
  decodeQrFromCameraFrame,
  decodeQrFromImageFile,
} from "@/lib/ai/qr-decode";

export function InstagramAnalyzeForm() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanRef = useRef<number | null>(null);
  const cameraActiveRef = useRef(false);

  const [instagramUrl, setInstagramUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState("");
  const [cameraOn, setCameraOn] = useState(false);

  const stopCamera = () => {
    cameraActiveRef.current = false;
    if (scanRef.current) {
      cancelAnimationFrame(scanRef.current);
      scanRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  const runAndGo = async (url: string) => {
    if (!url.trim()) {
      toast.error("Instagram havolasini kiriting yoki QR skanerlang");
      return;
    }

    try {
      setAnalyzing(true);
      setProgress("Instagram profili o'qilmoqda...");
      await simulateDemoDelay();
      setProgress("Biznes tahlil qilinmoqda...");
      await new Promise((r) => setTimeout(r, 700));

      const result = runDemoAnalysis(url);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      persistDemoAnalysis(result);
      router.push("/analyze/dashboard");
    } finally {
      setAnalyzing(false);
      setProgress("");
    }
  };

  const onQrFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await decodeQrFromImageFile(file);
      if (!url) {
        toast.error("QR kodda Instagram topilmadi");
        return;
      }
      setInstagramUrl(url);
      toast.success("QR o'qildi — tahlil boshlanmoqda");
      await runAndGo(url);
    } catch {
      toast.error("QR rasmni o'qib bo'lmadi");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      cameraActiveRef.current = true;
      setCameraOn(true);

      const tick = async () => {
        if (!cameraActiveRef.current || !videoRef.current) return;
        const url = await decodeQrFromCameraFrame(videoRef.current);
        if (url) {
          stopCamera();
          setInstagramUrl(url);
          toast.success("QR topildi!");
          await runAndGo(url);
          return;
        }
        scanRef.current = requestAnimationFrame(tick);
      };
      scanRef.current = requestAnimationFrame(tick);
    } catch {
      toast.error("Kameraga ruxsat bering yoki QR rasmini yuklang");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Demo biznes tahlili</p>
        <p className="mt-1">
          Instagram havolasi yoki QR kod kiriting — dashboardda arenda mosligi va
          mijoz oqimi ko&apos;rsatiladi.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEMO_QUICK_PICKS.map((p) => (
          <Button
            key={p.username}
            type="button"
            variant="outline"
            size="sm"
            disabled={analyzing}
            onClick={() => {
              const url = `https://instagram.com/${p.username}`;
              setInstagramUrl(url);
              void runAndGo(url);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="link" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="link">
            <Link2 className="mr-1.5 size-4" />
            Havola
          </TabsTrigger>
          <TabsTrigger value="qr">
            <QrCode className="mr-1.5 size-4" />
            QR kod
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link" className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Instagram havolasi</Label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="instagram.com/username"
                className="pl-9"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
              />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={analyzing}
            onClick={() => runAndGo(instagramUrl)}
          >
            {analyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bot className="size-4" />
            )}
            Tahlil qilish
          </Button>
        </TabsContent>

        <TabsContent value="qr" className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>QR rasm yuklash</Label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild disabled={analyzing}>
                <label className="cursor-pointer">
                  <Upload className="mr-2 size-4" />
                  QR rasmini tanlash
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onQrFile(e.target.files?.[0])}
                  />
                </label>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={analyzing || cameraOn}
                onClick={startCamera}
              >
                <Camera className="mr-2 size-4" />
                Kamera
              </Button>
            </div>
          </div>

          {cameraOn && (
            <div className="relative overflow-hidden rounded-lg border">
              <video
                ref={videoRef}
                className="aspect-square w-full object-cover"
                playsInline
                muted
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute bottom-2 right-2"
                onClick={stopCamera}
              >
                To&apos;xtatish
              </Button>
            </div>
          )}

          {instagramUrl && (
            <p className="text-xs text-muted-foreground">
              Topilgan: {instagramUrl}
            </p>
          )}
        </TabsContent>
      </Tabs>

      {progress && (
        <p className="text-center text-xs text-primary animate-pulse">{progress}</p>
      )}
    </div>
  );
}
