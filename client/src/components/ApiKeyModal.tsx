import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Shield,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { sessionManager, detectProvider, PROVIDER_CONFIGS } from '../services/sessionManager';
import { SessionState } from '../types/workflow';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionState: SessionState;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  sessionState,
}) => {
  const [keyInput, setKeyInput] = useState(sessionState.groqKeyInMemory || '');
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);

  const detectedProviderKey = keyInput.trim() ? detectProvider(keyInput) : null;
  const detectedConfig = detectedProviderKey ? PROVIDER_CONFIGS[detectedProviderKey] : null;

  useEffect(() => {
    if (isOpen) {
      setKeyInput(sessionState.groqKeyInMemory || '');
      setTestResult(null);
    }
  }, [isOpen, sessionState.groqKeyInMemory]);

  if (!isOpen) return null;

  const handleTestAndConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestResult(null);

    const res = await sessionManager.connectAndValidateKey(keyInput);
    if (res.success) {
      setTestResult({
        success: true,
        message: `Successfully connected ${res.provider || 'LLM'} key!`,
      });
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setTestResult({
        success: false,
        message: res.error || 'Connection failed. Please check your key.',
      });
    }
  };

  const handleDisconnect = () => {
    sessionManager.disconnectGroq();
    setKeyInput('');
    setTestResult({
      success: true,
      message: 'LLM key removed from browser memory.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white border border-[#E5E0D6] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-[#121316] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E0D6] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FFF0EB] border border-[#FFD9CC] text-[#FF4713] flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#121316]">Connect LLM Key</h3>
              <p className="text-[11px] text-[#636772]">Request-scoped credentials for real-time campaign synthesis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#8B8F9A] hover:text-[#121316] p-1 rounded-md hover:bg-[#FAF7F2] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleTestAndConnect} className="p-6 space-y-4">
          {/* Security & Memory-Only Notice */}
          <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#E5E0D6] text-[11px] text-[#121316] space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-[#121316]">
              <Shield className="w-3.5 h-3.5 text-[#1E7E34] flex-shrink-0" />
              In-Memory Session Security:
            </div>
            <p className="text-[#636772] leading-relaxed">
              Your LLM API key is held strictly in active browser memory and sent securely over HTTPS with each workflow checkpoint. It is never stored in database tables or logs.
            </p>
            <p className="text-[#B25E00] font-medium">
              Refreshing or closing the page requires reconnecting your key, while your saved workflow progress in Supabase remains available.
            </p>
          </div>

          {/* Masked API Key Input with Eye Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="groq-api-key" className="text-xs font-semibold text-[#121316]">
                LLM API Key
              </label>
              {detectedConfig && (
                <span className="text-[10px] font-semibold text-[#4A5404] bg-[#F5F8D5] border border-[#CBD810] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> {detectedConfig.name} Detected
                </span>
              )}
            </div>
            <div className="relative">
              <input
                id="groq-api-key"
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Paste API key (OpenAI sk-..., Groq gsk_..., OpenRouter, Anthropic)"
                disabled={sessionState.isTestingKey}
                className="w-full text-xs px-3.5 py-2.5 pr-10 bg-white border border-[#E5E0D6] rounded-xl text-[#121316] placeholder-[#8B8F9A] focus:outline-none focus:border-[#FF4713] focus:ring-1 focus:ring-[#FF4713] font-mono tracking-wide"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8B8F9A] hover:text-[#121316] cursor-pointer"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Provider Capability Indicator */}
            <div className="mt-2 text-[11px]">
              {detectedConfig ? (
                <div className="flex items-center gap-1.5 text-[#1E6FD9] bg-[#EDF5FF] border border-[#D0E2FF] px-2.5 py-1.5 rounded-lg">
                  <Sparkles className="w-3 h-3 text-[#1E6FD9] flex-shrink-0" />
                  <span>
                    Routing to <strong>{detectedConfig.name}</strong> • Default model: <code className="text-[#121316] font-mono text-[10px]">{detectedConfig.defaultModel}</code>
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-[#8B8F9A]">
                  Supported providers: OpenAI (<code className="font-mono text-[#636772]">sk-...</code>), Groq (<code className="font-mono text-[#636772]">gsk_...</code>), OpenRouter (<code className="font-mono text-[#636772]">sk-or-...</code>), Anthropic (<code className="font-mono text-[#636772]">sk-ant-...</code>)
                </p>
              )}
            </div>
          </div>

          {/* Test & Result Messages */}
          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                testResult.success
                  ? 'bg-[#F5F8D5] border-[#CBD810] text-[#4A5404]'
                  : 'bg-[#FDECEE] border-[#FAC5CB] text-[#C92A2A]'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-[#1E7E34] flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-[#C92A2A] flex-shrink-0" />
              )}
              <span className="font-medium">{testResult.message}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-between">
            {sessionState.groqKeyInMemory ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-[#C92A2A] hover:text-[#A61E1E] font-medium flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Disconnect Key
              </button>
            ) : (
              <span className="text-[11px] text-[#8B8F9A]">Requires valid API access</span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#636772] hover:text-[#121316] bg-[#FAF7F2] hover:bg-[#F0ECE1] border border-[#E5E0D6] rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!keyInput.trim() || sessionState.isTestingKey}
                className="px-5 py-2 text-xs font-bold text-white bg-[#FF4713] hover:bg-[#E03E0F] disabled:opacity-50 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {sessionState.isTestingKey ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Connect Key'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
