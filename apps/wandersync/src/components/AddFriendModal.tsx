import React, { useState } from 'react';
import { UserPlus, Copy, Check, Share2, MessageCircle, X, Users, QrCode } from 'lucide-react';
import { TravelerMember } from '../types';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  groupId: string;
  members: TravelerMember[];
}

export const AddFriendModal: React.FC<AddFriendModalProps> = ({
  isOpen,
  onClose,
  groupId,
  members,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}${window.location.pathname}?trip=${encodeURIComponent(
    groupId
  )}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.error('Failed to copy link', e);
    }
  };

  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(groupId);
      } else {
        const input = document.createElement('input');
        input.value = groupId;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (e) {
      console.error('Failed to copy code', e);
    }
  };

  const handleWhatsAppShare = () => {
    const text = `🚗 Join our live travel convoy "${groupId}" on WanderSync!\nTrack our positions in real-time on the map:\n${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join WanderSync Convoy: ${groupId}`,
          text: `Join our live travel convoy on WanderSync! Real-time squad navigation & tracking:`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-[28px] bg-slate-900/95 border border-slate-700/80 shadow-[0_20px_60px_rgba(0,0,0,0.8)] p-5 text-white flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Icon Badge */}
        <div className="relative mb-3 flex items-center justify-center">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-xl shadow-lg shadow-emerald-500/25">
            <UserPlus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
        </div>

        <h3 className="text-lg font-black tracking-tight text-white text-center">
          Add Friend to Convoy
        </h3>
        <p className="text-xs text-slate-300 text-center mt-1 max-w-[260px]">
          Share this invite. When friends open the link, their live GPS marker appears on your map.
        </p>

        {/* Trip Code Pill */}
        <div className="mt-3.5 w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold text-slate-400">Trip Code:</span>
            <span className="font-mono font-black text-sm text-emerald-400 tracking-wider">
              {groupId}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
          >
            {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* QR Code */}
        <div className="mt-3 p-2.5 bg-white rounded-2xl shadow-xl flex flex-col items-center">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
              shareUrl
            )}`}
            alt="Convoy QR Code"
            className="w-32 h-32 rounded-lg"
          />
        </div>
        <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
          <QrCode className="w-3 h-3" />
          Point any camera to join live
        </span>

        {/* Direct Link Input with Copy */}
        <div className="w-full flex items-center gap-1.5 mt-3">
          <input
            type="text"
            readOnly
            value={shareUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-[11px] font-mono rounded-xl px-2.5 py-2 truncate focus:outline-none select-all"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md transition shrink-0 flex items-center gap-1 cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied' : 'Copy'}</span>
          </button>
        </div>

        {/* Action Buttons: WhatsApp & Native Share */}
        <div className="w-full grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950" />
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handleNativeShare}
            className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>More Apps</span>
          </button>
        </div>

        {/* Active Connected Friends Count */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 w-full flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Currently Connected:</span>
          </span>
          <span className="font-bold text-white font-mono bg-slate-800/80 px-2 py-0.5 rounded-full">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>
      </div>
    </div>
  );
};
