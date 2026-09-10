import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, CheckCircle, Share, HelpCircle } from 'lucide-react';
import { ApkGuideModal } from './ApkGuideModal';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showApkGuide, setShowApkGuide] = useState(false);

  // App live URL
  const appUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-4bcxrfkrvv2ipi36d6coau-126357666009.asia-southeast1.run.app';

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* If already running as an installed PWA */}
        {isInstalled ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Installed App</span>
          </span>
        ) : (
          <>
            {/* Direct 1-Click Install Button (Chromium / Android) */}
            {isInstallable && (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-2xs transition-colors"
                title="Install app to your device"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install App</span>
              </button>
            )}

            {/* iOS Safari Fallback */}
            {isIOS && (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Share className="w-3.5 h-3.5" />
                <span>Install on iOS</span>
              </button>
            )}

            {/* APK & Mobile Installation Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowApkGuide(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors"
              title="Options for Android APK & Mobile Installation"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Android / APK</span>
            </button>
          </>
        )}
      </div>

      {/* iOS Safari Instructions Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 text-slate-800">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Share className="w-4 h-4 text-indigo-600" />
              Install on iPhone / iPad
            </h3>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              To install this application on your iOS home screen:
            </p>
            <ol className="mt-2 space-y-2 text-xs text-slate-700 list-decimal list-inside pl-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <li>Tap the <strong>Share</strong> icon in the Safari toolbar.</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong> in the top-right corner.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Android / APK Guide Modal */}
      <ApkGuideModal
        isOpen={showApkGuide}
        onClose={() => setShowApkGuide(false)}
        appUrl={appUrl}
      />
    </>
  );
};
