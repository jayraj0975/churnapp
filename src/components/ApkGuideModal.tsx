import React, { useState } from 'react';
import { X, Smartphone, Download, ExternalLink, Copy, Check, Terminal, ShieldCheck } from 'lucide-react';

interface ApkGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  appUrl: string;
}

export const ApkGuideModal: React.FC<ApkGuideModalProps> = ({ isOpen, onClose, appUrl }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyCode = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const bubblewrapSnippet = `npm install -g @bubblewrap/cli
npx @bubblewrap/cli init --manifest=${appUrl}/manifest.webmanifest
npx @bubblewrap/cli build`;

  const capacitorSnippet = `npm install @capacitor/core @capacitor/android
npx cap init "Churn Predictor" com.example.churnpredictor --web-dir=dist
npm run build
npx cap add android
npx cap open android`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Android APK & Mobile Installation
              </h2>
              <p className="text-xs text-slate-500">
                Install as a native-feel mobile app or generate a signed .apk file
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-600">
          {/* Method 1: Instant PWA Install on Android */}
          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
            <div className="flex items-center gap-2 text-indigo-900 font-semibold text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Method 1: Instant Install on Android (Recommended — No APK needed)
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              This app is a fully compliant Progressive Web App (PWA) with offline caching and standalone display. You can install it right now:
            </p>
            <ol className="list-decimal list-inside text-xs text-slate-700 space-y-1 pl-1">
              <li>Open <strong>Chrome</strong> on your Android device.</li>
              <li>Visit the live app URL.</li>
              <li>Tap the <strong>Install App</strong> button in the header, or open Chrome's menu (<strong>⋮</strong>) and tap <strong>"Add to Home screen" / "Install app"</strong>.</li>
              <li>It will appear with its own icon on your launcher and run in fullscreen standalone mode.</li>
            </ol>
          </div>

          {/* Method 2: 1-Click APK Generator (PWABuilder) */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs uppercase tracking-wider">
                <Download className="w-4 h-4 text-emerald-600" />
                Method 2: 1-Click Online APK Generator (PWABuilder)
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Easiest for APK
              </span>
            </div>
            <p className="text-xs text-slate-600">
              PWABuilder (by Microsoft) generates a production-ready Android package directly from your live PWA manifest:
            </p>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                type="text"
                readOnly
                value={appUrl}
                className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono select-all"
              />
              <button
                type="button"
                onClick={() => copyCode(appUrl, 1)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 shrink-0"
              >
                {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy URL</span>
              </button>
            </div>
            <div className="pt-1">
              <a
                href={`https://www.pwabuilder.com?url=${encodeURIComponent(appUrl)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                <span>Open PWABuilder with this App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-xs text-slate-400 block mt-1">
                Once on PWABuilder, click <strong>"Package for Android"</strong> to download the ready-to-sideload APK.
              </span>
            </div>
          </div>

          {/* Method 3: CLI APK Build with Google Bubblewrap */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-semibold text-xs uppercase tracking-wider">
                <Terminal className="w-4 h-4 text-indigo-600" />
                Method 3: Build APK via Google Bubblewrap CLI
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Run this on your computer (requires Java 17+ and Android SDK) to compile a signed `.apk`:
            </p>
            <div className="relative bg-slate-900 rounded-lg p-3 text-slate-100 font-mono text-xs overflow-x-auto">
              <button
                type="button"
                onClick={() => copyCode(bubblewrapSnippet, 2)}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Copy commands"
              >
                {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <pre className="pr-8">{bubblewrapSnippet}</pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
