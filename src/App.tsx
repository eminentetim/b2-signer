import React, { useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import axios from 'axios';
import { Ghost, ShieldCheck, AlertCircle, Loader2, CheckCircle, Info, Scale, ArrowRightLeft, User, Activity } from 'lucide-react';

import '@solana/wallet-adapter-react-ui/styles.css';

// Configure Axios for Production
// @ts-ignore
axios.defaults.baseURL = (import.meta as any).env?.VITE_BACKEND_URL || '';

const SignerContent = () => {
  const { publicKey, signMessage, connected } = useWallet();
  const [mode, setMode] = useState<'sign' | 'link' | 'rebalance' | 'dashboard' | 'limit' | 'dca' | 'tpsl'>('dashboard');
  const [params, setParams] = useState<any>(null);
  const [rebalanceData, setRebalanceData] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    
    const amount = urlParams.get('amount');
    const intentId = urlParams.get('intentId');
    const isLink = path.includes('link');
    
    if (path.includes('rebalance') || intentId) {
        setMode('rebalance');
        if (intentId) fetchRebalanceData(intentId);
    } else if (path.includes('limit')) {
        setMode('limit');
    } else if (path.includes('dca')) {
        setMode('dca');
    } else if (path.includes('tpsl')) {
        setMode('tpsl');
    } else if (amount) {
        setMode('sign');
    } else if (isLink) {
        setMode('link');
    } else {
        setMode('dashboard');
    }

    setParams({
      amount,
      intentId,
      in: urlParams.get('in'),
      out: urlParams.get('out'),
      from: urlParams.get('from'),
      to: urlParams.get('to'),
      mint: urlParams.get('mint'),
      price: urlParams.get('price'),
      freq: urlParams.get('freq'),
      tp: urlParams.get('tp'),
      sl: urlParams.get('sl'),
      userId: urlParams.get('userId'),
      msgId: urlParams.get('msgId'),
      nonce: Math.random().toString(36).substring(7),
    });

    if ((window as any).Telegram?.WebApp) {
        const twa = (window as any).Telegram.WebApp;
        twa.ready();
        twa.expand();
    }
  }, []);

  const fetchRebalanceData = async (id: string) => {
      try {
          const { data } = await axios.get(`/rebalance/${id}`);
          setRebalanceData(data);
      } catch (err) {
          console.error('Failed to fetch rebalance plan');
      }
  };

  const arrayBufferToBase64 = (buffer: Uint8Array) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };

  const handleAction = async () => {
    if (!publicKey || !params) return;
    if (!signMessage) {
        setError('Wallet does not support message signing.');
        setStatus('error');
        return;
    }

    try {
      setStatus('working');
      setError(null);

      const payload: any = {
        userId: params.userId,
        nonce: params.nonce,
        publicKey: publicKey.toBase58(),
        messageId: params.msgId ? parseInt(params.msgId) : undefined,
      };

      if (mode === 'sign') {
        payload.inputToken = params.in;
        payload.outputToken = params.out;
        payload.amount = parseFloat(params.amount);
      } else if (mode === 'rebalance') {
        payload.action = 'AUTHORIZE_REBALANCE';
        payload.intentId = params.intentId;
      } else if (mode === 'limit') {
        payload.action = 'CREATE_LIMIT_ORDER';
        payload.inputToken = params.in;
        payload.outputToken = params.out;
        payload.amountIn = parseFloat(params.amount);
        payload.triggerPrice = parseFloat(params.price);
      } else if (mode === 'dca') {
        payload.action = 'CREATE_DCA_ORDER';
        payload.fromToken = params.from;
        payload.toToken = params.to;
        payload.amount = parseFloat(params.amount);
        payload.frequency = params.freq;
      } else if (mode === 'tpsl') {
        payload.action = 'UPDATE_POSITION_PROTECTION';
        payload.tokenMint = params.mint;
        payload.amount = parseFloat(params.amount);
        payload.takeProfitPrice = params.tp ? parseFloat(params.tp) : undefined;
        payload.stopLossPrice = params.sl ? parseFloat(params.sl) : undefined;
      } else {
        payload.action = 'LINK_WALLET';
      }

      // Step 1: Get message and timestamp
      const response = await axios.get('/intent/message', { params: payload });
      const { message, timestamp } = response.data;
      if (!message) throw new Error('Backend failed to generate message');

      // Step 2: Sign
      const signature = await signMessage(new TextEncoder().encode(message));
      const signatureBase64 = arrayBufferToBase64(signature);

      // Step 3: POST to execute
      await axios.post('/intent', { ...payload, signature: signatureBase64, timestamp });

      setStatus('success');
      setTimeout(() => {
        if ((window as any).Telegram?.WebApp) (window as any).Telegram.WebApp.close();
      }, 3000);

    } catch (err: any) {
      console.error('B2 Signer Error:', err);
      setError(err.response?.data?.message || err.message || 'Action failed');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start pt-6 p-4 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-8 pb-4">
            <div className="flex items-center justify-between mb-6">
                <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20">
                    {mode === 'rebalance' ? <Scale className="w-8 h-8 text-indigo-400" /> : 
                     mode === 'sign' ? <ArrowRightLeft className="w-8 h-8 text-indigo-400" /> : 
                     <Ghost className="w-8 h-8 text-indigo-400" />}
                </div>
                <div className="text-right">
                    <h1 className="text-xl font-bold tracking-tight">
                        {mode === 'rebalance' ? 'Rebalance Hub' : mode === 'sign' ? 'Ghost Swap' : 'B2 Spirit'}
                    </h1>
                    <p className="text-xs text-slate-500 font-mono">STATUS: {connected ? 'ACTIVE' : 'READY'}</p>
                </div>
            </div>

            <div className="space-y-4">
                {mode === 'rebalance' && rebalanceData && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="p-5 bg-slate-950/50 rounded-3xl border border-slate-800">
                            <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">Planned Chunks</h2>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {rebalanceData.chunks.map((chunk: any, i: number) => (
                                    <div key={i} className="flex items-center justify-between text-xs p-3 bg-slate-900 rounded-xl border border-slate-800/50">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-500">#{i+1}</span>
                                            <span className="font-bold">{chunk.inputToken}</span>
                                            <Activity className="w-3 h-3 text-indigo-500" />
                                            <span className="font-bold">{chunk.outputToken}</span>
                                        </div>
                                        <span className="text-indigo-400 font-mono">{chunk.amount.toFixed(4)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-4 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            <p className="text-[11px] text-slate-400">Authorized chunks will be executed with randomized delays for maximum privacy.</p>
                        </div>
                    </div>
                )}

                {mode === 'limit' && params && (
                    <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 animate-in fade-in duration-500">
                        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Limit Order Setup</h2>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="text-center flex-1">
                                    <p className="text-2xl font-black">{params.amount}</p>
                                    <p className="text-[10px] text-slate-500 uppercase mt-1">Selling {params.in}</p>
                                </div>
                                <div className="px-4">
                                    <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-2xl font-black text-indigo-400">{params.out}</p>
                                    <p className="text-[10px] text-slate-500 uppercase mt-1">Buying</p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-800 text-center">
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Target Price</p>
                                <p className="text-xl font-mono text-emerald-400 font-bold">${params.price}</p>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'dca' && params && (
                    <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 animate-in fade-in duration-500">
                        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">DCA Accumulation</h2>
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="text-center flex-1">
                                    <p className="text-2xl font-black">{params.amount}</p>
                                    <p className="text-[10px] text-slate-500 uppercase mt-1">Spend {params.from}</p>
                                </div>
                                <div className="px-4">
                                    <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-2xl font-black text-indigo-400">{params.to}</p>
                                    <p className="text-[10px] text-slate-500 uppercase mt-1">Accumulate</p>
                                </div>
                            </div>
                            <div className="pt-4 border-t border-slate-800 text-center">
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Frequency</p>
                                <p className="text-lg font-bold text-indigo-400 uppercase">{params.freq}</p>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'tpsl' && params && (
                    <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 animate-in fade-in duration-500">
                        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Position Protection</h2>
                        <div className="space-y-6">
                            <div className="text-center">
                                <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-1">Protecting</p>
                                <p className="text-2xl font-black text-indigo-400">{params.mint?.substring(0, 8)}...</p>
                                <p className="text-[10px] text-slate-500 mt-1">{params.amount} Units</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                                <div className="text-center">
                                    <p className="text-slate-500 text-[9px] uppercase mb-1">Take Profit</p>
                                    <p className="text-lg font-mono text-emerald-400 font-bold">{params.tp ? `$${params.tp}` : 'OFF'}</p>
                                </div>
                                <div className="text-center border-l border-slate-800">
                                    <p className="text-slate-500 text-[9px] uppercase mb-1">Stop Loss</p>
                                    <p className="text-lg font-mono text-rose-400 font-bold">{params.sl ? `$${params.sl}` : 'OFF'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'sign' && params && (
                    <div className="p-6 bg-slate-950/50 rounded-3xl border border-slate-800 animate-in fade-in duration-500">
                        <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Trade Parameters</h2>
                        <div className="flex items-center justify-between">
                            <div className="text-center flex-1">
                                <p className="text-2xl font-black">{params.amount}</p>
                                <p className="text-[10px] text-slate-500 uppercase mt-1">Selling {params.in === 'So11111111111111111111111111111111111111112' ? 'SOL' : params.in}</p>
                            </div>
                            <div className="px-4">
                                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                    <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
                                </div>
                            </div>
                            <div className="text-center flex-1">
                                <p className="text-2xl font-black text-indigo-400">{(params.out || '').substring(0, 4)}</p>
                                <p className="text-[10px] text-slate-500 uppercase mt-1">Receiving</p>
                            </div>
                        </div>
                    </div>
                )}

                {mode === 'link' && (
                    <div className="py-8 text-center animate-in zoom-in-95 duration-500">
                        <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-indigo-500/20 shadow-inner">
                            <ShieldCheck className="w-10 h-10 text-indigo-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Activate Stealth</h2>
                        <p className="text-slate-400 text-sm max-w-[200px] mx-auto">Link your Solana wallet to your B2 Agent profile securely.</p>
                    </div>
                )}

                {mode === 'dashboard' && (
                    <div className="py-8 text-center">
                         <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                             <User className="w-8 h-8 text-slate-400" />
                         </div>
                         <p className="font-bold text-lg mb-1">B2 Control Center</p>
                         <p className="text-slate-500 text-xs px-8">This interface is for signing intents. Start a move in Telegram to see details here.</p>
                    </div>
                )}
            </div>
        </div>

        <div className="mt-auto p-8 bg-slate-950/30 border-t border-slate-800/50">
            <div className="flex flex-col gap-4">
                <div className="flex justify-center">
                    <WalletMultiButton className="!bg-slate-800 !hover:bg-slate-700 !rounded-2xl !h-14 !px-8 !w-full !font-bold !tracking-tight border border-slate-700" />
                </div>

                {connected && status === 'idle' && mode !== 'dashboard' && (
                    <button onClick={handleAction} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black h-16 rounded-2xl transition-all shadow-xl shadow-indigo-900/40 text-lg uppercase tracking-wider">
                        Authorize Action
                    </button>
                )}

                {status === 'working' && (
                    <div className="flex items-center justify-center gap-3 h-16">
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                        <span className="font-bold text-indigo-300 uppercase text-sm tracking-widest">Processing...</span>
                    </div>
                )}

                {status === 'success' && (
                    <div className="h-16 flex items-center justify-center gap-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                        <span className="text-emerald-400 font-bold uppercase text-sm">Move Confirmed</span>
                    </div>
                )}

                {status === 'error' && (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-3 items-center">
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                        <p className="text-rose-500 text-[11px] font-bold uppercase">{error}</p>
                    </div>
                )}
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-2 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
                <Info className="w-3 h-3" />
                <span className="text-[9px] uppercase font-bold tracking-[0.3em]">B2 Spirit Systems • 2026</span>
            </div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider><SignerContent /></WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;
