import { useEffect, useRef, useState } from "react";

interface Firefly {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  pulseSpeed: number;
  pulseOffset: number;
}

export function ForestBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firefliesRef = useRef<Firefly[]>([]);
  const animationRef = useRef<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      setIsLoaded(true);
    };

    resize();
    window.addEventListener("resize", resize);

    // Fireflies
    firefliesRef.current = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight * 0.5 + window.innerHeight * 0.25,
      size: Math.random() * 1.5 + 0.8,
      speedX: (Math.random() - 0.5) * 0.2,
      speedY: (Math.random() - 0.5) * 0.1 - 0.03,
      opacity: Math.random() * 0.2 + 0.15,
      pulseSpeed: Math.random() * 0.008 + 0.004,
      pulseOffset: Math.random() * Math.PI * 2,
    }));

    let time = 0;

    const drawMountain = (x: number, width: number, height: number) => {
      ctx.fillStyle = "rgba(15,22,30,0.9)";
      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x + width * 0.5, canvas.height - height);
      ctx.lineTo(x + width, canvas.height);
      ctx.fill();
    };

    const drawTree = (x: number, height: number, width: number) => {
      ctx.fillStyle = "rgba(8,14,18,0.98)";
      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x - width * 0.05, canvas.height);
      ctx.lineTo(x - width * 0.5, canvas.height - height * 0.4);
      ctx.lineTo(x, canvas.height - height);
      ctx.lineTo(x + width * 0.5, canvas.height - height * 0.4);
      ctx.closePath();
      ctx.fill();
    };

    const animate = () => {
      if (!isLoaded) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      time++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Sky
      const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      sky.addColorStop(0, "#050810");
      sky.addColorStop(1, "#080c10");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars
      ctx.fillStyle = "rgba(200,210,220,0.4)";
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Moon glow (top right)
      const moonGlow = ctx.createRadialGradient(
        canvas.width * 0.85,
        canvas.height * 0.15,
        0,
        canvas.width * 0.85,
        canvas.height * 0.15,
        canvas.width * 0.3
      );
      moonGlow.addColorStop(0, "rgba(180,190,210,0.08)");
      moonGlow.addColorStop(1, "transparent");
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Mountains
      drawMountain(canvas.width * 0.2, 300, 200);
      drawMountain(canvas.width * 0.5, 350, 250);

      // Trees left
      drawTree(0, 300, 150);
      drawTree(100, 250, 120);

      // Trees right
      drawTree(canvas.width - 100, 280, 140);
      drawTree(canvas.width - 200, 240, 120);

      // Fireflies
      firefliesRef.current.forEach(f => {
        f.x += f.speedX;
        f.y += f.speedY;

        if (f.x < 0) f.x = canvas.width;
        if (f.x > canvas.width) f.x = 0;

        const pulse = Math.sin(time * f.pulseSpeed + f.pulseOffset);
        const opacity = f.opacity + pulse * 0.1;

        const glow = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 10);
        glow.addColorStop(0, `rgba(200,240,170,${opacity})`);
        glow.addColorStop(1, "transparent");

        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 10, 0, Math.PI * 2);
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [isLoaded]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
      }}
    />
  );
}
