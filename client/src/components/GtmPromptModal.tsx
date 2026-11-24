import React, { useState } from 'react';
import { X, RotateCcw, BookOpen, Edit3 } from 'lucide-react';
import { gtmPromptManager, GtmTaskInstruction } from '../services/gtmPromptManager';

interface GtmPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GtmPromptModal: React.FC<GtmPromptModalProps> = ({ isOpen, onClose }) => {
  const [instructions, setInstructions] = useState<GtmTaskInstruction[]>(gtmPromptManager.getAll());
  const [selectedTask, setSelectedTask] = useState<string>(instructions[0]?.task || '');
  const [currentText, setCurrentText] = useState<string>(
    gtmPromptManager.getInstruction(instructions[0]?.task || '')
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const activeItem = instructions.find((i) => i.task === selectedTask) || instructions[0];

  const handleSelectTask = (task: string) => {
    setSelectedTask(task);
    setCurrentText(gtmPromptManager.getInstruction(task));
  };

  const handleSave = () => {
    gtmPromptManager.updateInstruction(selectedTask, currentText);
    setInstructions(gtmPromptManager.getAll());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleReset = () => {
    gtmPromptManager.resetInstruction(selectedTask);
    setInstructions(gtmPromptManager.getAll());
    setCurrentText(gtmPromptManager.getInstruction(selectedTask));
  };

  const handleResetAll = () => {
    gtmPromptManager.resetAll();
    setInstructions(gtmPromptManager.getAll());
    setCurrentText(gtmPromptManager.getInstruction(selectedTask));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white border border-[#E5E0D6] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[#121316]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E5E0D6] bg-[#FAF7F2]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FFF0EB] border border-[#FFD9CC] text-[#FF4713]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#121316] flex items-center gap-2">
                GTM Method & Task Instructions
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FAF7F2] text-[#636772] border border-[#E5E0D6]">
                  Separately Editable
                </span>
              </h3>
              <p className="text-xs text-[#636772] mt-0.5">
                Refine the Go-To-Market directives and prompt logic for each stage of the enrichment workflow.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8B8F9A] hover:text-[#121316] rounded-lg hover:bg-[#FAF7F2] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Two Columns */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E5E0D6]">
          {/* Left Column: Task selector */}
          <div className="p-4 bg-[#FAF7F2] overflow-y-auto space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#636772] px-2 block mb-2">
              Workflow Checkpoints
            </span>
            {instructions.map((inst) => {
              const isSelected = inst.task === selectedTask;
              const hasOverride = !!inst.userPromptOverride;
              return (
                <button
                  key={inst.task}
                  type="button"
                  onClick={() => handleSelectTask(inst.task)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition border flex flex-col gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-white border-[#FF4713] text-[#121316] shadow-xs'
                      : 'bg-[#FAF7F2] border-[#E5E0D6] text-[#636772] hover:text-[#121316] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{inst.name}</span>
                    {hasOverride && (
                      <span className="w-2 h-2 rounded-full bg-[#FF4713]" title="Customized by user" />
                    )}
                  </div>
                  <span className="text-[11px] text-[#636772] line-clamp-1">{inst.description}</span>
                </button>
              );
            })}

            <div className="pt-4 border-t border-[#E5E0D6] px-2">
              <button
                type="button"
                onClick={handleResetAll}
                className="text-[11px] text-[#8B8F9A] hover:text-[#C92A2A] flex items-center gap-1 transition cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Reset all to defaults
              </button>
            </div>
          </div>

          {/* Right Column: Prompt Editor */}
          <div className="p-5 md:col-span-2 overflow-y-auto flex flex-col space-y-4 bg-white">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-bold text-[#121316] flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#FF4713]" />
                  {activeItem.name}
                </h4>
                {activeItem.userPromptOverride && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFF4E5] text-[#B25E00] border border-[#FFE2B8]">
                    Custom Prompt Active
                  </span>
                )}
              </div>
              <p className="text-xs text-[#636772] leading-relaxed">{activeItem.description}</p>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="text-[11px] font-semibold text-[#121316] mb-1 flex items-center justify-between">
                <span>Task Instructions & System Directives</span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] text-[#8B8F9A] hover:text-[#FF4713] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> Revert to Default
                </button>
              </label>
              <textarea
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                rows={12}
                className="w-full p-3.5 bg-[#FAF7F2] border border-[#E5E0D6] rounded-xl text-xs font-mono text-[#121316] focus:outline-none focus:ring-1 focus:ring-[#FF4713] focus:border-[#FF4713] leading-relaxed resize-none"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E5E0D6]">
              <span className="text-xs text-[#636772]">
                {savedSuccess && (
                  <span className="text-[#1E7E34] font-medium">✓ Custom prompt instruction saved!</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-[#636772] hover:text-[#121316] bg-[#FAF7F2] hover:bg-[#F0ECE1] border border-[#E5E0D6] rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 text-xs font-bold text-white bg-[#FF4713] hover:bg-[#E03E0F] rounded-xl transition shadow-sm cursor-pointer"
                >
                  Save Directive
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
