"use client";

import { useState, useTransition } from "react";
import {
  generateMfaSetup,
  enableMfa,
  disableMfa,
} from "@/server/actions/mfa-actions";
import { useNotification } from "../providers/NotificationProvider";
import {
  ShieldCheck,
  Key,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function MfaSetup({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const { notify } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeUrl: string;
  } | null>(null);
  const [token, setToken] = useState("");

  const handleStartSetup = () => {
    startTransition(async () => {
      const res = await generateMfaSetup();
      if (res.secret && res.qrCodeUrl) {
        setSetupData({ secret: res.secret, qrCodeUrl: res.qrCodeUrl });
      } else {
        notify(
          "error",
          "Setup Failed",
          "Failed to generate authentication secret",
        );
      }
    });
  };

  const handleVerifyEnable = () => {
    if (!setupData || token.length !== 6) return;

    startTransition(async () => {
      const res = await enableMfa(setupData.secret, token);
      if (res.success) {
        notify(
          "success",
          "2FA Enabled",
          "Your account is now secured with Multi-factor authenticaion",
        );
        setIsEnabled(true);
        setSetupData(null);
        setToken("");
      } else {
        notify("error", "Verification Failed", res.error || "Incorrect Code");
      }
    });
  };

  const handleDisable = () => {
    if (!confirm("Are you sure you want to disable 2FA?")) return;

    startTransition(async () => {
      const res = await disableMfa();
      if (res.success) {
        notify(
          "info",
          "2FA Disabled",
          "Multi-Factor Authentication has been turned off",
        );
        setIsEnabled(false);
      }
    });
  };
  return (
    <div className="border border-border bg-surface p-6 rounded-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-foreground font-bold text-sm tracking-wide">
              Two-Factor Authentication (2FA)
            </h3>
          </div>
        {isEnabled && (
          <button
            onClick={handleDisable}
            disabled={isPending}
            className="px-3 py-1 bg-red-950/30 border border-red-900/50 hover:bg-red-500 text-red-500 hover:text-white transition-all text-xs font-bold rounded-lg active:scale-95 disabled:opacity-50"
          >
            Disable 2FA
          </button>
        )}
      </div>

      {!isEnabled && !setupData && (
        <div className="space-y-4">
          <p className="text-sm text-muted leading-relaxed">
            Add an extra layer of security
          </p>
          <button
            onClick={handleStartSetup}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <Key size={14} />
            )}
            Set Up 2FA
          </button>
        </div>
      )}
      {setupData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 animate-in slide-in-from-bottom duration-300">
          <div className="flex flex-col items-center justify-center p-4 bg-white border border-neutral-200 rounded-xl max-w-[220px] mx-auto">
            <img
              src={setupData.qrCodeUrl}
              className="w-40 h-40 object-contain"
              alt="MFA"
            />
            <span className="text-[10px] font-bold text-neutral-500 mt-2">
              SCAN QR CODE
            </span>
          </div>
          <div className="space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="text-xs font-bold text-foreground block">
                Verify Setup
              </span>
            </div>
            <div className="pt-2">
              <span className="text-[10px] font-bold text-neutral-500 mb-1">
                Mannual Entry Key
              </span>
              <code className="text-xs bg-background px-3 py-1 border border-border select-all rounded text-orange-500 font-bold block w-fit">
                {setupData.secret}
              </code>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text=[10px] font-bold text-neutral-500 mb-1">
                  6-Digit Code
                </label>
                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-center text-lg font-mono tracking-widest text-foreground focus:outline-none focus:border-orange-500 outline-none font-bold"
                />
              </div>
              <button
                onClick={handleVerifyEnable}
                disabled={isPending || token.length !== 6}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg h-[38px] flex items-center gap-1.5"
              >
                {isPending ? (
                  <Loader2 className="animate-spin w-4 h-4" />
                ) : (
                  <ArrowRight size={14} />
                )}
                Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
