'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card, StatusDot, Button, staggerContainer, fadeInUp } from '@hostel-monitor/ui';

interface HostelDetail {
    id: string;
    name: string;
    floors: Array<{
        id: string;
        number: number;
        cameraCount: number;
        activeAlertCount: number;
    }>;
}

export default function HostelPage({ params }: { params: { hostelId: string } }) {
  const [hostel, setHostel] = useState<HostelDetail | null>(null);

  useEffect(() => {
    fetch(`/api/hostels/${params.hostelId}`)
      .then(res => res.json())
      .then(data => setHostel(data))
      .catch(err => console.error(err));
  }, [params.hostelId]);

  if (!hostel) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-accent-blue"></div>
          </div>
      );
  }

  if ('error' in hostel) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <div className="text-alert-red font-mono font-bold">{(hostel as any).error}</div>
          </div>
      );
  }

  if (!hostel.floors) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <div className="text-text-secondary font-mono">No floor data available.</div>
          </div>
      );
  }

  return (
    <div className="min-h-screen p-8 pb-20 relative z-10">
      
      {/* Breadcrumb & Header */}
      <div className="mb-12">
          <div className="flex items-center gap-2 text-sm font-mono text-text-secondary mb-4">
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              <span>/</span>
              <span className="text-white">Hostel {hostel.id}</span>
          </div>
          
          <div className="flex items-end justify-between">
              <div>
                  <h1 className="text-4xl font-bold font-mono tracking-tight text-white mb-2">{hostel.name}</h1>
                  <p className="text-text-secondary">Sector Overview — Select floor to view camera matrix</p>
              </div>
          </div>
      </div>

      {/* Floors Grid */}
      <motion.div 
         className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
         variants={staggerContainer}
         initial="initial"
         animate="animate"
      >
          {hostel.floors.map(floor => (
              <Link key={floor.id} href={`/hostel/${hostel.id}/floor/${floor.number}`}>
                  <motion.div variants={fadeInUp}>
                      <Card className="aspect-square flex flex-col items-center justify-center relative group p-4 border-border hover:border-accent-blue/50 transition-colors cursor-pointer bg-surface/80 glass overflow-hidden">
                          {/* Top Right Status */}
                          <div className="absolute top-3 right-3">
                              <StatusDot 
                                  status={floor.activeAlertCount > 0 ? 'critical' : 'online'} 
                                  pulse={floor.activeAlertCount > 0} 
                              />
                          </div>

                          <span className="text-5xl font-mono font-bold text-white mb-2">{String(floor.number).padStart(2, '0')}</span>
                          
                          <div className="flex flex-col items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs font-mono text-text-secondary uppercase">Cameras: {floor.cameraCount}</span>
                              {floor.activeAlertCount > 0 && (
                                  <span className="text-xs font-mono text-alert-red font-semibold">{floor.activeAlertCount} Alerts</span>
                              )}
                          </div>
                          
                          {floor.activeAlertCount > 0 && (
                              <div className="absolute bottom-0 left-0 w-full h-1 bg-alert-red" />
                          )}
                      </Card>
                  </motion.div>
              </Link>
          ))}
      </motion.div>
    </div>
  );
}
