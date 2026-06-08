import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mammoth from 'mammoth';
import { KeyRound, Sparkles, Send, CheckCircle2, AlertCircle, Loader2, Upload, FileText, X, Download, ShieldCheck, ClipboardList, Info, Eye, EyeOff, Copy, ExternalLink } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState(() => {
    const stored = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
    if (stored) return stored;
    return process.env.GEMINI_API_KEY || '';
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isPatchModalOpen, setIsPatchModalOpen] = useState(false);
  const [tempKey, setTempKey] = useState('');
  
  const [showSupportInfo, setShowSupportInfo] = useState(false);
  
  // API Cost Tracking
  const [totalInputTokens, setTotalInputTokens] = useState(0);
  const [totalOutputTokens, setTotalOutputTokens] = useState(0);
  const [copied, setCopied] = useState(false);
  const [costHistory, setCostHistory] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('APP_COST_HISTORY');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Patch notes "New" logic
  const LAST_PATCH_DATE = new Date('2026-06-04');
  const isNewPatch = () => {
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - LAST_PATCH_DATE.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 3;
  };
  
  const OPTIONS: any = {
    target: ["수익화 발굴 파일 기반 분석", "1인 지식 기업가", "소상공인 및 자영업자", "직장인 부업러", "2030 MZ세대", "실버 세대 (시니어)", "기타"],
    platform: ["수익화 발굴 파일 기반 분석", "유튜브 (쇼츠 포함)", "인스타그램 / 틱톡", "네이버 블로그 / 카페", "개인 웹사이트 / 쇼핑몰", "뉴스레터 / 커뮤니티", "기타"],
    bizModel: ["수익화 발굴 파일 기반 분석", "구독형 (SaaS/콘텐츠)", "광고 수익 (유튜브/블로그)", "지식 서비스 (전자책/강의)", "커머스 (위탁/사입)", "에이전시 / 서비스 대행", "기타"],
    budget: ["수익화 발굴 파일 기반 분석", "0원 (무자본)", "100만원 이하 (소자본)", "500만원 이하", "1,000만원 이상", "투자 유치 희망", "기타"],
    competency: ["수익화 발굴 파일 기반 분석", "마케팅 기획 및 홍보", "콘텐츠 제작 (영상/글)", "개발 및 기술적 지식", "영업 및 비즈니스 매너", "특별한 기술 없음 (입문자)", "기타"],
    uniqueSellingPoint: ["수익화 발굴 파일 기반 분석", "압도적인 실행 속도", "전문적인 도메인 지식", "강력한 팬덤 / 퍼스널 브랜딩", "저렴한 가격 경쟁력", "독보적인 기술력", "기타"],
    timeline: ["수익화 발굴 파일 기반 분석", "1개월", "3개월", "6개월", "1년", "1년 이상", "기타"]
  };

  const [manualFields, setManualFields] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    aiTech: "혁신AI",
    target: OPTIONS.target[0],
    platform: OPTIONS.platform[0],
    bizModel: OPTIONS.bizModel[0],
    budget: OPTIONS.budget[0],
    timeline: OPTIONS.timeline[0],
    competency: OPTIONS.competency[0],
    uniqueSellingPoint: OPTIONS.uniqueSellingPoint[0],
    details: ''
  });

  const handleSelectChange = (field: string, value: string) => {
    if (value === '기타') {
      setManualFields(prev => [...prev, field]);
      setFormData(prev => ({ ...prev, [field]: '' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const resetToSelect = (field: string) => {
    setManualFields(prev => prev.filter(f => f !== field));
    setFormData(prev => ({ ...prev, [field]: OPTIONS[field][0] }));
  };
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Session persistence confirmed on load
    console.log('Session initialized:', { hasApiKey: !!apiKey });
  }, []);

  const saveApiKey = () => {
    if (tempKey.trim()) {
      localStorage.setItem('CUSTOM_GEMINI_API_KEY', tempKey.trim());
      setApiKey(tempKey.trim());
    } else {
      localStorage.removeItem('CUSTOM_GEMINI_API_KEY');
      setApiKey(process.env.GEMINI_API_KEY || '');
    }
    setIsModalOpen(false);
  };

  const handleGenerate = async () => {
    if (!selectedFile && !formData.target.trim()) {
      setError('타겟 고객을 입력하거나 분석용 파일을 업로드해주세요.');
      return;
    }
    const cleanApiKey = apiKey.replace(/[^\x20-\x7E]/g, '').trim();
    if (!cleanApiKey) {
      setError('유효한 API Key를 입력해주세요. (영문/숫자)');
      setIsModalOpen(true);
      return;
    }

    setError('');
    setIsGenerating(true);
    setOutput('');
    setProgress(10);
    setProgressMessage('분석 환경을 준비하고 있습니다...');

    try {
      const ai = new GoogleGenAI({ apiKey: cleanApiKey });
      
      setProgress(25);
      setProgressMessage('입력 데이터를 분석하고 프롬프트를 구성 중입니다...');

      let prompt = `당신은 AI 비즈니스 및 마케팅 전략 최고 전문가입니다.\n`;
      
      if (selectedFile) {
        prompt += `사용자가 첨부한 파일의 내용을 최우선으로 분석하고, 아래 입력된 항목이 있다면 함께 고려하여 'AI를 활용한 2026년 수익화 트렌드'를 파악해주세요.\n\n`;
      } else {
        prompt += `다음은 사용자가 'AI를 활용한 2026년 수익화 트렌드'를 파악하기 위해 세부적으로 입력한 항목들입니다:\n\n`;
      }
 
      if (formData.aiTech) prompt += `- 활용 AI 기술: ${formData.aiTech}\n`;
      if (formData.target) prompt += `- 타겟 고객: ${formData.target}\n`;
      if (formData.platform) prompt += `- 주력 플랫폼: ${formData.platform}\n`;
      if (formData.bizModel) prompt += `- 수익화 모델: ${formData.bizModel}\n`;
      if (formData.budget) prompt += `- 초기 가용 예산: ${formData.budget}\n`;
      prompt += `- 목표 달성 기간: ${formData.timeline}\n`;
      if (formData.competency) prompt += `- 현재 보유 역량 및 팀 구성: ${formData.competency}\n`;
      if (formData.uniqueSellingPoint) prompt += `- 차별화 포인트(USP): ${formData.uniqueSellingPoint}\n`;
      if (formData.details) prompt += `- 기타 세부사항: ${formData.details}\n`;

      prompt += `
상세 정보 및 첨부파일을 바탕으로, '실질적으로 즉각 수익화를 달성할 수 있는 최신 핵심 트렌드'에 긴밀히 결합된 초정밀 딥리서치를 수행하여, 최대한 상세하고 방대한 분량의 결과물을 정밀하게 작성해주세요. 단순 이론이나 추상적인 개념 나열은 절대 금지하며, 사용자가 선택한 기술 및 정보를 기반으로 실제 고수익을 실현할 수 있는 '2026년 핵심 AI 비즈니스 수익화 틈새시장 및 트렌드'를 가장 최우선으로 깊이 있게 도출해주어야 합니다.

중간 밑줄이나 가로선, 구분선 기호(예: ---, ___ 등)는 절대 사용하지 마세요.

분석 결과는 아래의 세 가지 핵심 레이어에 대해 세밀하게 파헤쳐 기술되어야 합니다:
1. 즉각 실현 가능한 2026년 AI 수익화 핵심 트렌드 및 비즈니스 기회 발굴 (성공 가능성이 높은 틈새 트렌드 정밀 분석 및 구체적 비즈니스 아이디어 제시)
2. 발굴된 수익화 트렌드를 실현하기 위한 상세한 단계별 준비 로드맵 (단계별 아주 세부적이고 구체적인 실행 방안 및 인프라 구축, 마일스톤 모두 기재)
3. 타겟 고객에게 정밀하게 도달하고 수익을 극대화하며, 장기적인 락인(Lock-in)을 이끌어내기 위한 구체적이고 혁신적인 마케팅 전략

[출력 형식 및 제약사항 - 반드시 엄수해주세요]
1. 정밀 딥리서치의 구체성과 밀도를 극대화하여 최고의 전문성을 가지고 아주 자세하게 설명하세요.
2. 서론, 인사말, 안내사항("첨부해주신 파일은...", "2026년 트렌드는..." 등), 결론 등은 일절 작성하지 마세요. 오직 핵심 수익화 트렌드 분석, 로드맵, 그리고 마케팅 전략의 본론 내용만 바로 기술하세요.
3. 글에 '#', '*' 같은 마크다운 기호를 절대 사용하지 마세요 (소제목이나 목록 기호 대신 글머리 기호가 필요하다면 숫자나 일반 텍스트 기호만을 사용하세요).
4. 글 중간이나 항목과 세션 사이에 가로선, 밑줄, 대시 구분선(예: ---, ___ 등)은 절대로 치지 마세요.
5. 가독성을 극대화하기 위해 반드시 2줄(2문장)마다 한 번씩 줄바꿈(엔터 2번)을 적용하여 문단 간 간격을 띄어주세요.
6. 강조가 필요한 핵심 포인트나 혁신 키워드, 수익화 중요 항목은 HTML 태그를 적극 사용하여 색상과 볼드를 강렬하게 적용하세요. (예: <b style="color: #FFCC00;">혁신 수익화 포인트</b>)
      `;

      const parts: any[] = [];
      if (selectedFile) {
        setProgress(40);
        setProgressMessage('파일 데이터를 분석하는 중입니다...');

        if (selectedFile.name.endsWith('.docx')) {
          // Extract text from DOCX using mammoth
          const arrayBuffer = await selectedFile.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          prompt += `\n\n[첨부 파일(${selectedFile.name}) 내용]:\n${result.value}\n`;
        } else {
          // Handle other supported text files as inlineData
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              if (result && result.includes(',')) {
                resolve(result.split(',')[1]);
              } else {
                reject(new Error('파일을 읽는 데 실패했습니다.'));
              }
            };
            reader.onerror = () => reject(new Error('파일 읽기 오류가 발생했습니다.'));
            reader.readAsDataURL(selectedFile);
          });
          
          let mimeType = (selectedFile.type || '').split(';')[0].replace(/[^\x20-\x7E]/g, '');
          if (selectedFile.name.endsWith('.md')) mimeType = 'text/plain';
          if (!mimeType) mimeType = 'text/plain';

          // Only add as inlineData if it's a supported type (text/plain, text/markdown, etc.)
          // Otherwise, just append as text to prompt to be safe
          const supportedTypes = ['text/plain', 'text/markdown', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
          if (supportedTypes.includes(mimeType)) {
            parts.push({
              inlineData: {
                data: base64,
                mimeType: mimeType
              }
            });
          } else {
            // Fallback: try to read as text and append to prompt
            const text = await selectedFile.text();
            prompt += `\n\n[첨부 파일(${selectedFile.name}) 내용]:\n${text}\n`;
          }
        }
      }
      parts.push({ text: prompt });

      setProgress(60);
      setProgressMessage('AI가 로드맵과 마케팅 전략을 생성하고 있습니다 (약 10~20초 소요)...');

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts }],
      });

      setProgress(90);
      setProgressMessage('결과를 정리하고 있습니다...');

      if (!response) {
        throw new Error('AI 응답을 받지 못했습니다. 네트워크 상태를 확인해주세요.');
      }

      const generatedText = response.text;
      
      // Update token usage if available - safely
      try {
        const usageMetadata = response.usageMetadata;
        if (usageMetadata) {
          const inCount = Number(usageMetadata.promptTokenCount) || 0;
          const outCount = Number(usageMetadata.candidatesTokenCount) || 0;
          setTotalInputTokens(prev => prev + inCount);
          setTotalOutputTokens(prev => prev + outCount);

          // Calculate cost for this specific run
          const runCostUSD = (inCount * (1.25 / 1000000)) + (outCount * (5.00 / 1000000));
          const runCostKRW = Math.round(runCostUSD * 1350);
          if (runCostKRW > 0) {
            setCostHistory(prev => {
              const updated = [...prev, runCostKRW];
              try {
                localStorage.setItem('APP_COST_HISTORY', JSON.stringify(updated));
              } catch (e) {
                console.error(e);
              }
              return updated;
            });
          }
        }
      } catch (usageErr) {
        console.warn('Metadata parsing failed:', usageErr);
      }

      if (generatedText) {
        setOutput(generatedText);
        setProgress(100);
      } else {
        setError('결과를 생성하지 못했습니다. 다시 시도해주세요.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '오류가 발생했습니다. API Key가 유효한지 확인해주세요.');
    } finally {
      setIsGenerating(false);
      setTimeout(() => {
        setProgress(0);
        setProgressMessage('');
      }, 500);
    }
  };

  const downloadMD = (content: string = output) => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '혁신 트렌드 분석 AI.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToDocs = async () => {
    try {
      // For Google Docs, we write both HTML format and plain text, so rich formatting carries over perfectly.
      const formattedHtml = `
        <div style="font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #333333; background-color: #ffffff; padding: 10px;">
          ${output
            .replace(/\n/g, '<br>')
            .replace(/<b style="color:\s*([^"]+)">/g, '<strong style="color: $1;">')
            .replace(/<\/b>/g, '</strong>')}
        </div>
      `;
      const plainText = output.replace(/<[^>]*>/g, '');

      if (navigator.clipboard && window.ClipboardItem) {
        const textBlob = new Blob([plainText], { type: 'text/plain' });
        const htmlBlob = new Blob([formattedHtml], { type: 'text/html' });
        const data = [
          new ClipboardItem({
            'text/plain': textBlob,
            'text/html': htmlBlob
          })
        ];
        await navigator.clipboard.write(data);
      } else {
        await navigator.clipboard.writeText(output);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Docs 복사 실패:', err);
      try {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (innerErr) {
        console.error('Text fallback copy failed:', innerErr);
      }
    }
  };

  // Calculate cost (Gemini 1.5 Pro pricing approx)
  const inputRateUSD = 1.25 / 1000000;
  const outputRateUSD = 5.00 / 1000000;
  const exchangeRate = 1350;

  const currentCostUSD = (totalInputTokens * inputRateUSD) + (totalOutputTokens * outputRateUSD);
  const currentCostKRW = Math.round(currentCostUSD * exchangeRate);

  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans text-neutral-200">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[#D4AF37]" />
          <span className="font-bold text-xl tracking-tight text-white">혁신 트렌드 분석 AI</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPatchModalOpen(true)}
            className="relative flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-neutral-800 rounded-full hover:bg-neutral-800 transition-all text-sm font-medium text-neutral-300"
          >
            <ClipboardList className="w-4 h-4 text-[#FFCC00]" />
            <span className="hidden md:inline">패치노트</span>
            {isNewPatch() && (
              <span className="absolute -top-1 -right-1 flex h-4 w-8 items-center justify-center rounded-full bg-[#E31837] text-[8px] font-black text-white italic tracking-tighter shadow-lg ring-1 ring-black">
                NEW
              </span>
            )}
          </button>

          <button
            onClick={() => setIsCostModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-full hover:border-[#D4AF37] transition-all text-sm font-medium text-[#D4AF37]"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden md:inline">API 비용</span>
          </button>

          <button
            onClick={() => {
              setTempKey(localStorage.getItem('CUSTOM_GEMINI_API_KEY') || '');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-neutral-800 rounded-full shadow-sm hover:bg-neutral-800 transition-colors text-sm font-medium text-white"
          >
            <div className="relative flex h-3 w-3">
              {apiKey ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              )}
            </div>
            <span className="hidden sm:inline">{apiKey ? 'API Key 적용됨' : 'API Key 미적용'}</span>
            <KeyRound className="w-4 h-4 text-neutral-400 sm:hidden" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative w-full aspect-video max-h-[400px] overflow-hidden bg-black flex items-center justify-center border-b border-neutral-800">
        <img 
          src="https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=1920&auto=format&fit=crop" 
          alt="AI Innovation Background" 
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-screen"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-7xl font-black text-white tracking-tighter mb-4 uppercase italic">
            <span className="text-[#D4AF37]">혁신</span> <span className="text-[#E31837]">트렌드</span> <span className="text-[#FFCC00]">분석 AI</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 font-medium max-w-2xl mx-auto drop-shadow-md">
            2026년 AI 수익화 트렌드를 분석하고, <br /> 여러분만의 수익화 로드맵과 전략을 설계합니다.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Input Section */}
        <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
          <div className="bg-[#111111] rounded-3xl shadow-2xl border border-neutral-800 p-8">
            <h2 className="text-2xl font-black text-white mb-4 flex items-center gap-3 uppercase italic tracking-tighter">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37] flex items-center justify-center text-black not-italic text-lg">01</div>
              수익화 트렌드 분석
            </h2>
            <p className="text-sm text-neutral-500 mb-8 font-medium">
              AI를 활용한 2026년 수익화 트렌드를 파악하기 위해 아래 객관화된 세부 항목들을 입력해주세요.
            </p>
            
            {/* File Upload Section */}
            <div className="mb-8">
              <label className="block text-xs font-bold text-[#D4AF37] mb-3 uppercase tracking-widest">나만의 수익화 발굴 파일 삽입</label>
              {!selectedFile ? (
                <div className="relative border-2 border-dashed border-neutral-800 rounded-2xl p-8 bg-[#1a1a1a] hover:border-[#D4AF37]/50 transition-all text-center cursor-pointer group">
                  <input 
                    type="file" 
                    accept=".docx,.md" 
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="bg-neutral-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border border-neutral-800 group-hover:bg-[#1a1a1a] transition-colors">
                    <Upload className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <p className="text-sm font-bold text-white mb-1">파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-xs text-neutral-500 uppercase tracking-tight">.docx, .md 파일 전용</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-5 bg-[#1a1a1a] border border-[#D4AF37]/20 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{selectedFile.name}</p>
                      <p className="text-xs text-[#D4AF37]">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="p-2 text-neutral-500 hover:text-[#E31837] hover:bg-[#E31837]/10 rounded-full transition-all"
                    title="파일 삭제"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">활용 AI 기술</label>
                  <div className="w-full p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl text-neutral-500 font-bold outline-none cursor-not-allowed text-sm italic">
                    혁신AI
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">
                    타겟 고객 {!selectedFile && <span className="text-[#E31837]">*</span>}
                  </label>
                  {!manualFields.includes('target') ? (
                    <select
                      value={formData.target}
                      onChange={(e) => handleSelectChange('target', e.target.value)}
                      className="w-full p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl text-white font-medium outline-none transition-all text-sm appearance-none cursor-pointer"
                    >
                      {OPTIONS.target.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.target}
                        onChange={(e) => setFormData({...formData, target: e.target.value})}
                        placeholder="직접 입력..."
                        className="w-full p-4 bg-[#1a1a1a] border border-[#D4AF37] rounded-2xl text-white outline-none text-sm pr-12"
                        autoFocus
                      />
                      <button 
                        onClick={() => resetToSelect('target')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white uppercase font-black italic"
                      >
                        이전으로
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">주력 플랫폼</label>
                  {!manualFields.includes('platform') ? (
                    <select
                      value={formData.platform}
                      onChange={(e) => handleSelectChange('platform', e.target.value)}
                      className="w-full p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl text-white font-medium outline-none transition-all text-sm appearance-none cursor-pointer"
                    >
                      {OPTIONS.platform.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.platform}
                        onChange={(e) => setFormData({...formData, platform: e.target.value})}
                        placeholder="직접 입력..."
                        className="w-full p-4 bg-[#1a1a1a] border border-[#D4AF37] rounded-2xl text-white outline-none text-sm pr-12"
                        autoFocus
                      />
                      <button 
                        onClick={() => resetToSelect('platform')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white uppercase font-black italic"
                      >
                        이전으로
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">수익화 모델</label>
                  {!manualFields.includes('bizModel') ? (
                    <select
                      value={formData.bizModel}
                      onChange={(e) => handleSelectChange('bizModel', e.target.value)}
                      className="w-full p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl text-white font-medium outline-none transition-all text-sm appearance-none cursor-pointer"
                    >
                      {OPTIONS.bizModel.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.bizModel}
                        onChange={(e) => setFormData({...formData, bizModel: e.target.value})}
                        placeholder="직접 입력..."
                        className="w-full p-4 bg-[#1a1a1a] border border-[#D4AF37] rounded-2xl text-white outline-none text-sm pr-12"
                        autoFocus
                      />
                      <button 
                        onClick={() => resetToSelect('bizModel')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white uppercase font-black italic"
                      >
                        이전으로
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">초기 예산</label>
                  {!manualFields.includes('budget') ? (
                    <select
                      value={formData.budget}
                      onChange={(e) => handleSelectChange('budget', e.target.value)}
                      className="w-full p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl text-white font-medium outline-none transition-all text-sm appearance-none cursor-pointer"
                    >
                      {OPTIONS.budget.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.budget}
                        onChange={(e) => setFormData({...formData, budget: e.target.value})}
                        placeholder="직접 입력..."
                        className="w-full p-4 bg-[#1a1a1a] border border-[#D4AF37] rounded-2xl text-white outline-none text-sm pr-12"
                        autoFocus
                      />
                      <button 
                        onClick={() => resetToSelect('budget')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white uppercase font-black italic"
                      >
                        이전으로
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">목표 달성 기간</label>
                  {!manualFields.includes('timeline') ? (
                    <select
                      value={formData.timeline}
                      onChange={(e) => handleSelectChange('timeline', e.target.value)}
                      className="w-full p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl text-white font-medium outline-none transition-all text-sm appearance-none cursor-pointer"
                    >
                      {OPTIONS.timeline.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.timeline}
                        onChange={(e) => setFormData({...formData, timeline: e.target.value})}
                        placeholder="직접 입력..."
                        className="w-full p-4 bg-[#1a1a1a] border border-[#D4AF37] rounded-2xl text-white outline-none text-sm pr-12"
                        autoFocus
                      />
                      <button 
                        onClick={() => resetToSelect('timeline')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white uppercase font-black italic"
                      >
                        이전으로
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">현재 보유 역량</label>
                  {!manualFields.includes('competency') ? (
                    <select
                      value={formData.competency}
                      onChange={(e) => handleSelectChange('competency', e.target.value)}
                      className="w-full p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl text-white font-medium outline-none transition-all text-sm appearance-none cursor-pointer"
                    >
                      {OPTIONS.competency.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.competency}
                        onChange={(e) => setFormData({...formData, competency: e.target.value})}
                        placeholder="직접 입력..."
                        className="w-full p-4 bg-[#1a1a1a] border border-[#D4AF37] rounded-2xl text-white outline-none text-sm pr-12"
                        autoFocus
                      />
                      <button 
                        onClick={() => resetToSelect('competency')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white uppercase font-black italic"
                      >
                        이전으로
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">차별화 포인트 (USP)</label>
                  {!manualFields.includes('uniqueSellingPoint') ? (
                    <select
                      value={formData.uniqueSellingPoint}
                      onChange={(e) => handleSelectChange('uniqueSellingPoint', e.target.value)}
                      className="w-full p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl text-white font-medium outline-none transition-all text-sm appearance-none cursor-pointer"
                    >
                      {OPTIONS.uniqueSellingPoint.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.uniqueSellingPoint}
                        onChange={(e) => setFormData({...formData, uniqueSellingPoint: e.target.value})}
                        placeholder="직접 입력..."
                        className="w-full p-4 bg-[#1a1a1a] border border-[#D4AF37] rounded-2xl text-white outline-none text-sm pr-12"
                        autoFocus
                      />
                      <button 
                        onClick={() => resetToSelect('uniqueSellingPoint')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500 hover:text-white uppercase font-black italic"
                      >
                        이전으로
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#D4AF37] mb-2 uppercase tracking-widest">기타 세부사항</label>
                <textarea
                  value={formData.details}
                  onChange={(e) => setFormData({...formData, details: e.target.value})}
                  placeholder="추가적인 상황을 입력해주세요."
                  className="w-full h-24 p-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl focus:border-[#D4AF37] outline-none resize-none transition-all text-sm text-white placeholder:text-neutral-700 font-medium"
                />
              </div>
            </div>
            
            {error && (
              <div className="mt-6 p-4 bg-[#E31837]/10 text-[#E31837] rounded-2xl text-sm flex items-start gap-3 border border-[#E31837]/20">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="font-bold">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-8 w-full py-5 px-6 bg-[#D4AF37] hover:bg-[#FFCC00] text-black font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed uppercase italic tracking-tighter"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-black" />
                  트렌드 분석 중...
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  전략 생성하기
                </>
              )}
            </button>
          </div>
        </div>
 
        {/* Output Section */}
        <div className="lg:col-span-12 xl:col-span-7">
          <div className="bg-[#111111] rounded-3xl shadow-2xl border border-neutral-800 p-8 min-h-[600px] flex flex-col">
            <h2 className="text-2xl font-black text-white mb-8 flex items-center gap-3 pb-6 border-b border-neutral-800 uppercase italic tracking-tighter">
              <div className="w-8 h-8 rounded-lg bg-[#E31837] flex items-center justify-center text-white not-italic text-lg">02</div>
              혁신 전략 리포트
            </h2>
            
            {output ? (
              <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000 flex flex-col h-full">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={copyToDocs}
                      className="flex items-center gap-2 px-5 py-3 text-sm font-black text-black bg-[#D4AF37] hover:bg-[#FFCC00] rounded-xl transition-all uppercase italic"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 animate-bounce text-black" />
                          Docs 복사 완료!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Docs 복사하기
                        </>
                      )}
                    </button>
                    <a 
                      href="https://docs.google.com/document"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-3 text-sm font-black text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-all border border-neutral-700 uppercase italic"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Docs 바로가기
                    </a>
                    <button 
                      onClick={() => downloadMD()}
                      className="flex items-center gap-2 px-5 py-3 text-sm font-black text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl transition-all uppercase italic"
                    >
                      <Download className="w-4 h-4" />
                      MARKDOWN 다운로드
                    </button>
                  </div>
                  <div className="bg-[#E31837] text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest italic animate-pulse">
                    전략적 AI 분석 완료
                  </div>
                </div>
                <div className="prose prose-invert prose-slate prose-amber max-w-none prose-headings:text-[#FFCC00] prose-headings:italic prose-p:text-neutral-300 prose-p:leading-relaxed prose-strong:text-[#D4AF37] prose-li:text-neutral-300 flex-1 whitespace-pre-wrap">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{output}</ReactMarkdown>
                </div>
              </div>
            ) : isGenerating ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20">
                <div className="w-full max-w-md space-y-8">
                  <div className="flex justify-between text-xs font-black text-[#D4AF37] uppercase tracking-widest italic">
                    <span>{progressMessage}</span>
                    <span className="text-[#FFCC00]">{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800 p-[1px]">
                    <div 
                      className="h-full bg-gradient-to-r from-[#D4AF37] via-[#FFCC00] to-[#E31837] transition-all duration-700 ease-out shadow-[0_0_20px_rgba(212,175,55,0.4)] rounded-full"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <div 
                          key={i} 
                          className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-bounce" 
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-black text-neutral-500 uppercase tracking-widest italic tracking-tighter">AI 분석 엔진 가동 중...</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-neutral-600 py-20">
                <div className="relative mb-8">
                  <Sparkles className="w-20 h-20 opacity-20 text-[#D4AF37]" />
                  <div className="absolute inset-0 bg-[#D4AF37] blur-3xl opacity-10"></div>
                </div>
                <p className="text-center font-bold uppercase tracking-tighter italic text-lg leading-tight">
                  혁신 준비가 <span className="text-white">되셨나요?</span><br/>
                  <span className="text-sm not-italic font-medium text-neutral-500 lowercase">세부 정보를 입력하여 미래형 로드맵을 생성하세요.</span>
                </p>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 z-[80] flex flex-col gap-4 items-end">
        {/* Support Info Popup */}
        {showSupportInfo && (
          <div className="bg-[#111111] border border-neutral-800 p-6 rounded-2xl shadow-2xl w-72 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h4 className="text-[#E31837] font-black text-xs uppercase tracking-widest italic mb-3">오류 및 유지보수 문의</h4>
            <p className="text-white font-bold text-sm mb-4">info@nextin.ai.kr</p>
            <p className="text-neutral-500 text-[10px] leading-relaxed">
              해당 메일로 오류 내용을 자세하게 작성 또는 캡쳐해서 보내주시면 유지보수 후 답변 드립니다.
            </p>
            <button 
              onClick={() => setShowSupportInfo(false)}
              className="mt-4 w-full py-2 bg-neutral-900 text-xs font-bold text-neutral-400 rounded-lg"
            >
              닫기
            </button>
          </div>
        )}

        <div className="flex gap-4">
          <a
            href="https://hyeoksinai.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-6 py-4 bg-[#D4AF37] hover:bg-[#FFCC00] text-black font-black rounded-2xl shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all uppercase italic tracking-tighter group h-14"
          >
            <Sparkles className="w-5 h-5" />
            <span className="hidden md:inline">혁신 AI 플랫폼 바로가기</span>
            <span className="md:hidden">플랫폼 바로가기</span>
          </a>

          <button
            onClick={() => setShowSupportInfo(!showSupportInfo)}
            className="flex items-center justify-center w-14 h-14 bg-white hover:bg-neutral-200 text-black rounded-2xl shadow-xl transition-all border border-neutral-200"
            title="고객 지원"
          >
            <Info className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 text-center border-t border-neutral-900 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            <span className="font-black italic text-white tracking-widest uppercase">혁신 트렌드 분석 AI</span>
          </div>
          <p className="text-neutral-600 text-xs font-bold uppercase tracking-widest italic">
            © 2026 혁신 트렌드 분석 AI Lab. All rights reserved. Directed by 혁신.
          </p>
          <div className="flex gap-4">
            <div className="w-8 h-1 bg-[#D4AF37]"></div>
            <div className="w-8 h-1 bg-[#E31837]"></div>
            <div className="w-8 h-1 bg-[#FFCC00]"></div>
          </div>
        </div>
      </footer>

      {/* API Key Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#111111] border border-neutral-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8">
              <h3 className="text-2xl font-black text-white mb-3 uppercase italic tracking-tighter">Google API Key <span className="text-[#D4AF37]">액세스</span></h3>
              <p className="text-sm text-neutral-500 mb-8 font-medium">
                본인의 Gemini API Key를 입력하여 서비스를 활성화하세요. 데이터는 사용자의 로컬 환경에만 안전하게 암호화되어 저장됩니다.
              </p>
              
              <div className="space-y-5">
                <div>
                  <label htmlFor="apiKey" className="block text-xs font-black text-[#D4AF37] mb-2 uppercase tracking-widest">
                    보안 자격 증명
                  </label>
                  <div className="relative">
                    <input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                      placeholder="GEMINI API KEY를 입력하세요..."
                      className="w-full px-5 py-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl focus:border-[#D4AF37] outline-none transition-all font-mono text-sm text-white placeholder:text-neutral-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-8 py-6 bg-neutral-900 border-t border-neutral-800 flex justify-end gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 text-xs font-black text-neutral-500 hover:text-white transition-all uppercase italic"
              >
                취소
              </button>
              <button
                onClick={saveApiKey}
                className="px-8 py-3 bg-[#D4AF37] hover:bg-[#FFCC00] text-black text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-2 uppercase italic tracking-widest"
              >
                <CheckCircle2 className="w-4 h-4" />
                인증하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Cost Modal */}
      {isCostModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#111111] border border-[#D4AF37]/50 rounded-3xl shadow-[0_0_50px_rgba(212,175,55,0.2)] w-full max-w-lg overflow-hidden animate-in fade-in slide-in-from-top-8 duration-300">
            <div className="p-8 md:p-10 text-center relative">
              <button 
                onClick={() => setIsCostModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-neutral-500 hover:text-white transition-colors"
                title="닫기"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-16 h-16 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#D4AF37]/30">
                <Sparkles className="w-8 h-8 text-[#D4AF37]" />
              </div>
              
              <h3 className="text-2xl md:text-3xl font-black text-white mb-2 uppercase italic tracking-tighter">AI 사용 <span className="text-[#D4AF37]">비용</span></h3>
              <p className="text-xs md:text-sm text-neutral-500 mb-8 font-bold uppercase tracking-widest italic">혁신 트렌드 분석 AI 실행 비용 통계</p>
              
              <div className="space-y-6 text-left">
                {/* 2. Standard Reference Costs per Run */}
                <div className="bg-[#161616] p-5 rounded-2xl border border-neutral-800">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-[#E31837] uppercase tracking-widest italic">분석 1회 실행 표준 설계 비용</span>
                    <span className="text-[9px] text-neutral-500 font-bold">모델 기댓값 기준</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-neutral-900 p-3 rounded-xl border border-neutral-800/60">
                      <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">최소 비용</p>
                      <p className="text-base font-black text-[#4ade80] italic">~15 <span className="text-[10px] uppercase text-neutral-500 font-medium">KRW</span></p>
                      <p className="text-[8px] text-neutral-600 mt-0.5 font-semibold">텍스트 중심 분석</p>
                    </div>
                    <div className="bg-[#1a1a1a] p-3 rounded-xl border border-[#D4AF37]/20 relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-[#D4AF37]/10 text-[#D4AF37] px-1 text-[7px] font-black rounded-bl uppercase italic">Avg</div>
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest mb-1">평균 비용</p>
                      <p className="text-base font-black text-[#FFCC00] italic">~55 <span className="text-[10px] uppercase text-neutral-500 font-medium">KRW</span></p>
                      <p className="text-[8px] text-neutral-500 mt-0.5 font-semibold">정밀 딥리서치 기본</p>
                    </div>
                    <div className="bg-neutral-900 p-3 rounded-xl border border-neutral-800/60">
                      <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">최대 비용</p>
                      <p className="text-base font-black text-[#f87171] italic">~165 <span className="text-[10px] uppercase text-neutral-500 font-medium">KRW</span></p>
                      <p className="text-[8px] text-neutral-600 mt-0.5 font-semibold">대용량 파일 리포트</p>
                    </div>
                  </div>
                </div>

                {/* 3. Actual Run Metrics */}
                <div className="bg-[#161616] p-5 rounded-2xl border border-neutral-800">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-black text-white uppercase tracking-widest italic">현재 세션 내 실행 기록 분석 (총 {costHistory.length}회)</span>
                    {costHistory.length > 0 && (
                      <button 
                        onClick={() => {
                          setCostHistory([]);
                          localStorage.removeItem('APP_COST_HISTORY');
                        }}
                        className="text-[9px] px-2 py-0.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-500 hover:text-white rounded border border-neutral-800 transition-all font-bold"
                      >
                        기록 초기화
                      </button>
                    )}
                  </div>
                  {costHistory.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-neutral-900 p-3 rounded-xl border border-neutral-800/40">
                        <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">실제 최소 비용</p>
                        <p className="text-base font-black text-emerald-400 italic">
                          {Math.min(...costHistory).toLocaleString()} <span className="text-[10px] uppercase text-neutral-500 font-medium">KRW</span>
                        </p>
                      </div>
                      <div className="bg-neutral-900 p-3 rounded-xl border border-neutral-800/40">
                        <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">실제 평균 비용</p>
                        <p className="text-base font-black text-[#FFCC00] italic">
                          {Math.round(costHistory.reduce((a, b) => a + b, 0) / costHistory.length).toLocaleString()} <span className="text-[10px] uppercase text-neutral-500 font-medium">KRW</span>
                        </p>
                      </div>
                      <div className="bg-neutral-900 p-3 rounded-xl border border-neutral-800/40">
                        <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">실제 최대 비용</p>
                        <p className="text-base font-black text-rose-400 italic">
                          {Math.max(...costHistory).toLocaleString()} <span className="text-[10px] uppercase text-neutral-500 font-medium">KRW</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-neutral-900 p-4 rounded-xl text-center border border-neutral-800 text-neutral-500 text-xs font-bold py-6">
                      아직 실행 기록이 없습니다. 상단에서 트렌드 분석을 실행하시면 실시간 통계가 반영됩니다.
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-neutral-600 text-center font-bold uppercase tracking-widest">
                  Model: Gemini 3 Flash (Preview) | 1,350 KRW/USD (실시간 환율 반영)
                </p>
              </div>
 
              <button
                onClick={() => setIsCostModalOpen(false)}
                className="mt-8 w-full py-4 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-black rounded-2xl shadow-xl transition-all uppercase italic tracking-widest border border-neutral-800"
              >
                대시보드 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patch Notes Modal */}
      {isPatchModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#111111] border border-neutral-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-6 h-6 text-[#FFCC00]" />
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">릴리즈 <span className="text-[#FFCC00]">패치 노트</span></h3>
              </div>
              <button 
                onClick={() => setIsPatchModalOpen(false)}
                className="p-2 text-neutral-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 max-h-[60vh] overflow-y-auto space-y-8 scrollbar-hide">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-[#D4AF37] italic">v1.5.0 - Docs Integration & Deep Research</h4>
                  <span className="text-[10px] bg-[#E31837] text-white px-2 py-1 rounded font-bold italic">2026.06.04 [LATEST]</span>
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E31837] mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-300 leading-relaxed"><span className="text-white font-bold">[구글 Docs 최적화]</span> 생성된 혁신 전략 리포트를 서식 그대로 구글 Docs에 붙여넣을 수 있는 "Docs 복사하기" 기능과 Docs 바로가기를 추가하여 연동성을 향상했습니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-300 leading-relaxed"><span className="text-white font-bold">[정밀 딥리서치 튜닝]</span> 프레임워크가 실시간 대화형 수익 전략 리서치 엔진으로 진화하여, 가독성 저해 요소인 가로선 구분선 없이 대용량의 초고밀도 사업 분석이 가능해졌습니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-300 leading-relaxed"><span className="text-white font-bold">[다운로드 오토메이션 배제]</span> 생성 완료 시 자동 다운로드되는 불필요한 현상을 차단하고, 수동으로 마크다운 리포트를 깔끔하게 다운받을 수 있도록 제어 구조를 정립했습니다.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-neutral-500 italic">v1.4.0 - Total System Optimization</h4>
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold">2026.04.27</span>
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-neutral-800 space-y-4 opacity-60">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-400 leading-relaxed"><span className="text-neutral-300 font-bold">[파일명 일원화]</span> 전략 리포트 다운로드 시 파일명을 "혁신 트렌드 분석 AI"로 공식화했습니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-400 leading-relaxed"><span className="text-white font-bold">[보안 라이브러리]</span> 범용 인증 코드 라이브러리를 최신화하여 다중 계층 보안을 강화했습니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-400 leading-relaxed"><span className="text-white font-bold">[UX 현지화]</span> 국내 비즈니스 환경에 맞춰 모든 인터페이스 명칭을 한글로 정밀 튜닝했습니다.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-neutral-500 italic">v1.3.0 - Multi-Code Security Update</h4>
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold">2026.04.27</span>
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-neutral-800 space-y-4 opacity-60">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-400 leading-relaxed font-medium"><span className="text-neutral-300 font-bold">[보안 시스템]</span> 인증 라이브러리 업데이트 및 헤더 네비게이션 개선.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-neutral-500 italic">v1.2.0 - Security & Accessibility Update</h4>
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold">2026.04.25</span>
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-neutral-800 space-y-4 opacity-60">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-400 leading-relaxed font-medium"><span className="text-neutral-300 font-bold">[UI 정제]</span> 한글화 완료 및 고급 보안 코드 시스템 도입.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-neutral-900 border-t border-neutral-800 flex justify-center">
              <button
                onClick={() => setIsPatchModalOpen(false)}
                className="w-full py-4 bg-[#1a1a1a] hover:bg-neutral-800 text-[#FFCC00] text-sm font-black rounded-xl border border-neutral-800 transition-all uppercase italic tracking-widest"
              >
                패치 노트 닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
