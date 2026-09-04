'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, useMotionTemplate } from 'framer-motion';
import { FiArrowRight } from 'react-icons/fi';
import { useAuroraColor } from '@/context/AuroraColorContext';

export interface AuroraHeroProps {
  badgeText?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  ctaText?: string;
  onCtaClick?: () => void;
  ctaHref?: string;
}

function StarfieldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const numStars = 200;
    const stars = Array.from({ length: numStars }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random(),
      speed: Math.random() * 0.008 + 0.002,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        star.alpha += star.speed;
        if (star.alpha > 1 || star.alpha < 0) {
          star.speed = -star.speed;
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(star.alpha)})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

export function AuroraHero({
  badgeText = 'Beta Now Live!',
  title = (
    <>
      Decrease your SaaS churn by over <span className="text-white">90%</span>
    </>
  ),
  description = 'Lorem ipsum, dolor sit amet consectetur adipisicing elit. Quae, et possimus inventore iste quo veritatis corrupti eligendi.',
  ctaText = 'Start free trial',
  onCtaClick,
  ctaHref,
}: AuroraHeroProps) {
  const [mounted, setMounted] = useState(false);
  const color = useAuroraColor();

  useEffect(() => {
    setMounted(true);
  }, []);

  const backgroundImage = useMotionTemplate`radial-gradient(125% 125% at 50% 0%, #020617 50%, ${color})`;
  const border = useMotionTemplate`1px solid ${color}`;
  const boxShadow = useMotionTemplate`0px 4px 24px ${color}`;

  const ButtonContent = (
    <motion.button
      style={{
        border,
        boxShadow,
      }}
      whileHover={{
        scale: 1.015,
      }}
      whileTap={{
        scale: 0.985,
      }}
      onClick={onCtaClick}
      className="group relative flex w-fit items-center gap-2 rounded-full bg-gray-950/80 px-6 py-3.5 text-sm font-semibold text-gray-50 transition-colors duration-200 hover:bg-gray-900 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/40"
    >
      <span>{ctaText}</span>
      <FiArrowRight className="text-base transition-transform duration-200 group-hover:-rotate-45 group-active:-rotate-12" />
    </motion.button>
  );

  return (
    <motion.section
      style={{
        backgroundImage,
      }}
      className="relative min-h-screen overflow-hidden bg-gray-950 px-4 py-24 text-gray-200 grid place-content-center"
    >
      {/* Animated Starfield Background Canvas */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {mounted && <StarfieldCanvas />}
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-5xl mx-auto">
        {/* Top Badge */}
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-gray-600/50 px-3.5 py-1.5 text-xs font-medium text-gray-200 border border-white/10 backdrop-blur-md shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {badgeText}
        </span>

        {/* Hero Heading */}
        <h1 className="max-w-4xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-bold tracking-tight text-transparent sm:text-5xl md:text-7xl leading-[1.15]">
          {title}
        </h1>

        {/* Hero Body Description */}
        <p className="my-6 max-w-xl text-center text-base sm:text-lg leading-relaxed text-gray-400 font-sans">
          {description}
        </p>

        {/* Dynamic Glowing CTA Button */}
        {ctaHref ? (
          <a href={ctaHref} className="inline-block">
            {ButtonContent}
          </a>
        ) : (
          ButtonContent
        )}
      </div>
    </motion.section>
  );
}

export default AuroraHero;
