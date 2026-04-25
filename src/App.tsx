import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import mammoth from 'mammoth';
import { KeyRound, Sparkles, Send, CheckCircle2, AlertCircle, Loader2, Upload, FileText, X, Download, ShieldCheck, ClipboardList, Info } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);
  const [isPatchModalOpen, setIsPatchModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAuthVerified, setIsAuthVerified] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [tempAuthCode, setTempAuthCode] = useState('');
  
  // API Cost Tracking
  const [totalInputTokens, setTotalInputTokens] = useState(0);
  const [totalOutputTokens, setTotalOutputTokens] = useState(0);
  
  const OPTIONS: any = {
    target: ["1인 지식 기업가", "소상공인 및 자영업자", "직장인 부업러", "2030 MZ세대", "실버 세대 (시니어)", "기타"],
    platform: ["유튜브 (쇼츠 포함)", "인스타그램 / 틱톡", "네이버 블로그 / 카페", "개인 웹사이트 / 쇼핑몰", "뉴스레터 / 커뮤니티", "기타"],
    bizModel: ["구독형 (SaaS/콘텐츠)", "광고 수익 (유튜브/블로그)", "지식 서비스 (전자책/강의)", "커머스 (위탁/사입)", "에이전시 / 서비스 대행", "기타"],
    budget: ["0원 (무자본)", "100만원 이하 (소자본)", "500만원 이하", "1,000만원 이상", "투자 유치 희망", "기타"],
    competency: ["마케팅 기획 및 홍보", "콘텐츠 제작 (영상/글)", "개발 및 기술적 지식", "영업 및 비즈니스 매너", "특별한 기술 없음 (입문자)", "기타"],
    uniqueSellingPoint: ["압도적인 실행 속도", "전문적인 도메인 지식", "강력한 팬덤 / 퍼스널 브랜딩", "저렴한 가격 경쟁력", "독보적인 기술력", "기타"],
    timeline: ["1개월", "3개월", "6개월", "1년", "1년 이상", "기타"]
  };

  const [manualFields, setManualFields] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    aiTech: "혁신AI",
    target: OPTIONS.target[0],
    platform: OPTIONS.platform[0],
    bizModel: OPTIONS.bizModel[0],
    budget: OPTIONS.budget[0],
    timeline: OPTIONS.timeline[2],
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
    // Check local storage for custom API key first, fallback to env
    const storedKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
    if (storedKey) {
      setApiKey(storedKey);
    } else if (process.env.GEMINI_API_KEY) {
      setApiKey(process.env.GEMINI_API_KEY);
    }

    // Check for app authentication
    const authVerified = localStorage.getItem('APP_AUTH_VERIFIED');
    if (authVerified === 'true') {
      setIsAuthVerified(true);
    }
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

  const handleVerifyCode = () => {
    if (tempAuthCode.trim() === 'dc5') {
      setIsAuthVerified(true);
      localStorage.setItem('APP_AUTH_VERIFIED', 'true');
      setIsAuthModalOpen(false);
      setTempAuthCode('');
    } else {
      setError('인증 코드가 올바르지 않습니다.');
    }
  };

  const handleGenerate = async () => {
    if (!isAuthVerified) {
      setError('앱 기능을 사용하려면 코드 인증이 필요합니다.');
      setIsAuthModalOpen(true);
      return;
    }
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
위 항목들을 심층적으로 분석하여 다음 두 가지를 아주 상세하고 전문적으로 작성해주세요:
1. 수익화 준비를 위한 상세한 준비 로드맵 (단계별, 구체적인 실행 방안 포함)
2. 타겟 고객 도달 및 수익 극대화를 위한 구체적이고 혁신적인 마케팅 전략

[출력 형식 및 제약사항 - 반드시 지켜주세요]
1. 서론, 인사말, 안내사항("첨부해주신 파일은...", "2026년 트렌드는..." 등), 결론 등은 일절 작성하지 마세요. 오직 '상세 준비 로드맵'과 '마케팅 전략' 본문만 바로 시작하세요.
2. 글에 '#', '*' 같은 마크다운 기호를 절대 사용하지 마세요. (소제목이나 목록 기호 대신 숫자나 일반 텍스트 기호를 사용하세요).
3. 가독성을 위해 반드시 2줄(2문장)마다 한 번씩 줄바꿈(엔터 2번)을 하여 문단을 띄어주세요.
4. 강조가 필요한 핵심 포인트는 HTML 태그를 사용하여 색상과 볼드를 적용하세요. (예: <b style="color: #4f46e5;">핵심 키워드</b>)
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
        model: 'gemini-1.5-pro',
        contents: { parts },
      });

      setProgress(90);
      setProgressMessage('결과를 정리하고 있습니다...');

      // Update token usage if available
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        setTotalInputTokens(prev => prev + (usageMetadata.promptTokenCount || 0));
        setTotalOutputTokens(prev => prev + (usageMetadata.candidatesTokenCount || 0));
      }

      if (response.text) {
        setOutput(response.text);
        setProgress(100);
        
        // Auto download both files
        setTimeout(() => {
          downloadMD(response.text);
          downloadWord(response.text);
        }, 500);
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
    a.download = '수익화_로드맵_전략.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWord = (content: string = output) => {
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"></head>
      <body>
        ${content.replace(/\n/g, '<br>')}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '수익화_로드맵_전략.doc';
    a.click();
    URL.revokeObjectURL(url);
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
          <span className="font-bold text-xl tracking-tight text-white">혁신 트렌드 AI</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPatchModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-neutral-800 rounded-full hover:bg-neutral-800 transition-all text-sm font-medium text-neutral-300"
          >
            <ClipboardList className="w-4 h-4 text-[#FFCC00]" />
            <span className="hidden md:inline">패치노트</span>
          </button>

          {!isAuthVerified && (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#E31837]/10 border border-[#E31837]/30 rounded-full hover:bg-[#E31837]/20 transition-all text-sm font-medium text-[#E31837]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>코드 인증</span>
            </button>
          )}

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
            <span className="text-[#D4AF37]">혁신</span> <span className="text-[#E31837]">트렌드</span> <span className="text-[#FFCC00]">AI</span>
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 font-medium max-w-2xl mx-auto drop-shadow-md">
            2026년 AI 수익화 트렌드를 분석하고, 당신만의 완벽한 비즈니스 로드맵과 마케팅 전략을 설계하세요.
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
                        Back
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
                        Back
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
                        Back
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
                        Back
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
                        Back
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
                        Back
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
                        Back
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
                  ANALYZING TRENDS...
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  GENERATE STRATEGY
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
                  <div className="flex gap-3">
                    <button 
                      onClick={() => downloadWord()}
                      className="flex items-center gap-2 px-5 py-3 text-sm font-black text-black bg-[#D4AF37] hover:bg-[#FFCC00] rounded-xl transition-all uppercase italic"
                    >
                      <Download className="w-4 h-4" />
                      DOCX
                    </button>
                    <button 
                      onClick={() => downloadMD()}
                      className="flex items-center gap-2 px-5 py-3 text-sm font-black text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-all uppercase italic"
                    >
                      <Download className="w-4 h-4" />
                      MARKDOWN
                    </button>
                  </div>
                  <div className="bg-[#E31837] text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest italic animate-pulse">
                    Strategic AI Analysis Complete
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
                    <span className="text-xs font-black text-neutral-500 uppercase tracking-widest italic tracking-tighter">Initializing AI Core...</span>
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
                  Ready to <span className="text-white">Innovate?</span><br/>
                  <span className="text-sm not-italic font-medium text-neutral-500 lowercase">Enter details to generate your futuristic roadmap.</span>
                </p>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-12 text-center border-t border-neutral-900 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" />
            <span className="font-black italic text-white tracking-widest uppercase">혁신 트렌드 AI</span>
          </div>
          <p className="text-neutral-600 text-xs font-bold uppercase tracking-widest italic">
            © 2026 혁신 트렌드 AI Lab. All rights reserved. Directed by 혁신.
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
              <h3 className="text-2xl font-black text-white mb-3 uppercase italic tracking-tighter">Google API Key <span className="text-[#D4AF37]">Access</span></h3>
              <p className="text-sm text-neutral-500 mb-8 font-medium">
                본인의 Gemini API Key를 입력하여 서비스를 활성화하세요. 데이터는 사용자의 로컬 환경에만 안전하게 암호화되어 저장됩니다.
              </p>
              
              <div className="space-y-5">
                <div>
                  <label htmlFor="apiKey" className="block text-xs font-black text-[#D4AF37] mb-2 uppercase tracking-widest">
                    Security credentials
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="ENTER YOUR GEMINI API KEY..."
                    className="w-full px-5 py-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl focus:border-[#D4AF37] outline-none transition-all font-mono text-sm text-white placeholder:text-neutral-800"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-8 py-6 bg-neutral-900 border-t border-neutral-800 flex justify-end gap-4">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 text-xs font-black text-neutral-500 hover:text-white transition-all uppercase italic"
              >
                Cancel
              </button>
              <button
                onClick={saveApiKey}
                className="px-8 py-3 bg-[#D4AF37] hover:bg-[#FFCC00] text-black text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-2 uppercase italic tracking-widest"
              >
                <CheckCircle2 className="w-4 h-4" />
                Authorize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Cost Modal */}
      {isCostModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-[#111111] border border-[#D4AF37]/50 rounded-3xl shadow-[0_0_50px_rgba(212,175,55,0.2)] w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-top-8 duration-300">
            <div className="p-10 text-center relative">
              <button 
                onClick={() => setIsCostModalOpen(false)}
                className="absolute top-6 right-6 p-2 text-neutral-500 hover:text-white transition-colors"
                title="닫기"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-20 h-20 bg-[#D4AF37]/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-[#D4AF37]/30">
                <Sparkles className="w-10 h-10 text-[#D4AF37]" />
              </div>
              
              <h3 className="text-3xl font-black text-white mb-2 uppercase italic tracking-tighter">AI Usage <span className="text-[#D4AF37]">Cost</span></h3>
              <p className="text-sm text-neutral-500 mb-10 font-bold uppercase tracking-widest italic">실시간 API 소모 예산 분석</p>
              
              <div className="space-y-8">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-neutral-800">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Input Tokens</p>
                    <p className="text-xl font-black text-white italic">{totalInputTokens.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#1a1a1a] p-4 rounded-2xl border border-neutral-800">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1">Output Tokens</p>
                    <p className="text-xl font-black text-white italic">{totalOutputTokens.toLocaleString()}</p>
                  </div>
                </div>

                <div className="py-10 border-y border-neutral-800 relative">
                   <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#111111] px-4 text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.3em] italic">
                     Estimated Total
                   </div>
                   <div className="text-6xl font-black text-[#FFCC00] italic tracking-tighter mb-2">
                     {currentCostKRW.toLocaleString()}<span className="text-2xl ml-2 not-italic text-neutral-400">KRW</span>
                   </div>
                   <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
                     Model: Gemini 1.5 Pro (Preview) | 1,350 KRW/USD
                   </p>
                </div>
              </div>

              <button
                onClick={() => setIsCostModalOpen(false)}
                className="mt-12 w-full py-5 bg-neutral-900 hover:bg-neutral-800 text-white font-black rounded-2xl shadow-xl transition-all uppercase italic tracking-widest border border-neutral-800"
              >
                Close Dashboard
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
                <h3 className="text-2xl font-black text-white uppercase italic tracking-tighter">Release <span className="text-[#FFCC00]">Patch Notes</span></h3>
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
                  <h4 className="text-lg font-black text-[#D4AF37] italic">v1.2.0 - Security & Accessibility Update</h4>
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold">2026.04.25</span>
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E31837] mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-300 leading-relaxed"><span className="text-white font-bold">[보안 강화]</span> 애플리케이션 진입 시 코드 인증 시스템(dc5)이 도입되었습니다. 미인증 시 전략 생성 기능이 제한됩니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-300 leading-relaxed"><span className="text-white font-bold">[UI 개선]</span> 헤더 레이아웃을 리디자인하여 패치노트 및 인증 상태 확인이 용이하도록 개선되었습니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-300 leading-relaxed"><span className="text-white font-bold">[사용성 향상]</span> 실시간 패치노트 확인 시스템이 가동되어 업데이트 소식을 빠르게 받아볼 수 있습니다.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-black text-[#D4AF37] italic">v1.1.0 - Core System Innovation</h4>
                  <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-1 rounded font-bold">2026.04.22</span>
                </div>
                <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-300 leading-relaxed"><span className="text-white font-bold">[비용 대시보드]</span> 실시간 API 사용량 및 예상 KRW 환산 금액 표시 기능을 구현했습니다.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E31837] mt-2 shrink-0"></div>
                    <p className="text-sm text-neutral-300 leading-relaxed"><span className="text-white font-bold">[브랜딩 리디자인]</span> 블랙, 골드, 레드, 옐로우 톤앤매너로 전체 UI를 럭셔리 스타일로 변경했습니다.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-8 bg-neutral-900 border-t border-neutral-800 flex justify-center">
              <button
                onClick={() => setIsPatchModalOpen(false)}
                className="w-full py-4 bg-[#1a1a1a] hover:bg-neutral-800 text-[#FFCC00] text-sm font-black rounded-xl border border-neutral-800 transition-all uppercase italic tracking-widest"
              >
                Close Patch Notes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Authentication Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-[#111111] border border-[#E31837]/30 rounded-3xl shadow-[0_0_50px_rgba(227,24,55,0.15)] w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-10 text-center">
              <div className="w-16 h-16 bg-[#E31837]/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#E31837]/20">
                <ShieldCheck className="w-8 h-8 text-[#E31837]" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">System <span className="text-[#E31837]">Authentication</span></h3>
              <p className="text-sm text-neutral-500 mb-8 font-medium">서비스 이용을 위해 관리자로부터 발급받은<br/>보안 코드를 입력해 주세요.</p>
              
              <div className="space-y-6">
                <div>
                  <input
                    type="text"
                    value={tempAuthCode}
                    onChange={(e) => setTempAuthCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                    placeholder="ENTER AUTH CODE..."
                    className="w-full px-5 py-4 bg-[#1a1a1a] border border-neutral-800 rounded-2xl focus:border-[#E31837] outline-none transition-all font-mono text-center text-xl text-white tracking-[0.5em] placeholder:tracking-normal placeholder:text-neutral-800 font-black"
                  />
                </div>
                
                {error && error.includes('인증 코드') && (
                  <div className="p-3 bg-[#E31837]/10 text-[#E31837] rounded-xl text-xs font-bold border border-[#E31837]/20">
                    {error}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={() => setIsAuthModalOpen(false)}
                    className="flex-1 py-4 text-xs font-black text-neutral-500 hover:text-white transition-all uppercase italic"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyCode}
                    className="flex-2 py-4 bg-[#E31837] hover:bg-[#ff1f3d] text-white text-xs font-black rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 uppercase italic tracking-widest"
                  >
                    Verify Code
                  </button>
                </div>
              </div>
              
              <div className="mt-8 flex items-center justify-center gap-2 text-neutral-600 text-[10px] font-bold uppercase tracking-widest italic">
                <Info className="w-3 h-3" />
                <span>Encrypted Security Channel Active</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
