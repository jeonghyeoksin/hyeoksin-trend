import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { KeyRound, Sparkles, Send, CheckCircle2, AlertCircle, Loader2, Upload, FileText, X, Download } from 'lucide-react';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tempKey, setTempKey] = useState('');
  
  const [formData, setFormData] = useState({
    aiTech: '혁신AI',
    target: '',
    platform: '',
    bizModel: '',
    budget: '',
    timeline: '6개월',
    competency: '',
    uniqueSellingPoint: '',
    details: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [output, setOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check local storage for custom API key first, fallback to env
    const storedKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
    if (storedKey) {
      setApiKey(storedKey);
    } else if (process.env.GEMINI_API_KEY) {
      setApiKey(process.env.GEMINI_API_KEY);
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

  const handleGenerate = async () => {
    if (!selectedFile && !formData.target.trim()) {
      setError('타겟 고객을 입력하거나 분석용 파일을 업로드해주세요.');
      return;
    }
    if (!apiKey) {
      setError('우측 상단에서 API Key를 설정해주세요.');
      setIsModalOpen(true);
      return;
    }

    setError('');
    setIsGenerating(true);
    setOutput('');

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      let prompt = `당신은 AI 비즈니스 및 마케팅 전략 최고 전문가입니다.\n`;
      
      if (selectedFile) {
        prompt += `사용자가 첨부한 파일의 내용을 최우선으로 분석하고, 아래 입력된 항목이 있다면 함께 고려하여 'AI를 활용한 2026년 수익화 트렌드'를 파악해주세요.\n\n`;
      } else {
        prompt += `다음은 사용자가 'AI를 활용한 2026년 수익화 트렌드'를 파악하기 위해 세부적으로 입력한 항목들입니다:\n\n`;
      }

      prompt += `- 활용 AI 기술: 혁신AI (고정)\n`;
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
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
        
        let mimeType = selectedFile.type;
        if (selectedFile.name.endsWith('.md')) mimeType = 'text/plain';
        if (!mimeType) mimeType = 'text/plain';

        parts.push({
          inlineData: {
            data: base64,
            mimeType: mimeType
          }
        });
      }
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
      });

      if (response.text) {
        setOutput(response.text);
      } else {
        setError('결과를 생성하지 못했습니다. 다시 시도해주세요.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || '오류가 발생했습니다. API Key가 유효한지 확인해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadMD = () => {
    const blob = new Blob([output], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '수익화_로드맵_전략.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadWord = () => {
    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"></head>
      <body>
        ${output.replace(/\n/g, '<br>')}
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-600" />
          <span className="font-bold text-xl tracking-tight text-slate-900">혁신 트렌드 AI</span>
        </div>
        
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-slate-500 hidden sm:block">개발자: 정혁신</span>
          <button
            onClick={() => {
              setTempKey(localStorage.getItem('CUSTOM_GEMINI_API_KEY') || '');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition-colors text-sm font-medium"
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
            <KeyRound className="w-4 h-4 text-slate-600 sm:hidden" />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative w-full aspect-video max-h-[400px] overflow-hidden bg-slate-900 flex items-center justify-center">
        <img 
          src="https://images.unsplash.com/photo-1634152962476-4b8a00e1915c?q=80&w=1920&auto=format&fit=crop" 
          alt="AI Innovation Background" 
          className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
        <div className="relative z-10 text-center px-4">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-4 drop-shadow-lg">
            혁신 트렌드 AI
          </h1>
          <p className="text-lg md:text-xl text-slate-200 font-medium max-w-2xl mx-auto drop-shadow-md">
            2026년 AI 수익화 트렌드를 분석하고, 당신만의 완벽한 비즈니스 로드맵과 마케팅 전략을 설계하세요.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Section */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-sm">1</span>
              수익화 트렌드 분석 항목
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              AI를 활용한 2026년 수익화 트렌드를 파악하기 위해 아래 객관화된 세부 항목들을 입력해주세요.
            </p>
            
            {/* File Upload Section */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wider">나만의 수익화 발굴 파일 삽입</label>
              {!selectedFile ? (
                <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 bg-slate-50 hover:bg-slate-100 transition-colors text-center cursor-pointer">
                  <input 
                    type="file" 
                    accept=".docx,.md" 
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-medium text-slate-600">파일을 드래그하거나 클릭하여 업로드 (.docx, .md)</p>
                  <p className="text-xs text-slate-400 mt-1">파일 업로드 시 아래 항목을 생략해도 전략 생성이 가능합니다.</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-indigo-900">{selectedFile.name}</p>
                      <p className="text-xs text-indigo-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-full transition-colors"
                    title="파일 삭제"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">활용 AI 기술</label>
                  <input
                    type="text"
                    value={formData.aiTech}
                    disabled
                    className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-medium outline-none cursor-not-allowed text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">
                    타겟 고객 {!selectedFile && '*'}
                  </label>
                  <input
                    type="text"
                    value={formData.target}
                    onChange={(e) => setFormData({...formData, target: e.target.value})}
                    placeholder="예: 1020 Z세대, 1인 기업가"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">주력 플랫폼</label>
                  <input
                    type="text"
                    value={formData.platform}
                    onChange={(e) => setFormData({...formData, platform: e.target.value})}
                    placeholder="예: 유튜브 쇼츠, 인스타그램 릴스"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">수익화 모델</label>
                  <input
                    type="text"
                    value={formData.bizModel}
                    onChange={(e) => setFormData({...formData, bizModel: e.target.value})}
                    placeholder="예: 구독형, 광고 수익, 전자책 판매"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">초기 가용 예산</label>
                  <input
                    type="text"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: e.target.value})}
                    placeholder="예: 0원 (무자본), 500만원"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">목표 달성 기간</label>
                  <select
                    value={formData.timeline}
                    onChange={(e) => setFormData({...formData, timeline: e.target.value})}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm appearance-none"
                  >
                    <option value="1개월">1개월 (단기 속성)</option>
                    <option value="3개월">3개월 (빠른 실행)</option>
                    <option value="6개월">6개월 (안정적 구축)</option>
                    <option value="1년">1년 (장기 프로젝트)</option>
                    <option value="1년 이상">1년 이상</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">현재 보유 역량</label>
                  <input
                    type="text"
                    value={formData.competency}
                    onChange={(e) => setFormData({...formData, competency: e.target.value})}
                    placeholder="예: 마케팅 지식 있음, 개발 모름"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">차별화 포인트 (USP)</label>
                  <input
                    type="text"
                    value={formData.uniqueSellingPoint}
                    onChange={(e) => setFormData({...formData, uniqueSellingPoint: e.target.value})}
                    placeholder="예: 압도적인 디자인 퀄리티, 빠른 속도"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 uppercase tracking-wider">기타 세부사항</label>
                <textarea
                  value={formData.details}
                  onChange={(e) => setFormData({...formData, details: e.target.value})}
                  placeholder="예: 매일 2시간씩 부업으로 진행 예정 등 추가적인 상황을 적어주세요."
                  className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none transition-all text-sm"
                />
              </div>
            </div>
            
            {error && (
              <div className="mt-4 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="mt-6 w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  전략 생성 중...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  로드맵 및 전략 생성하기
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[400px]">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 pb-4 border-b border-slate-100">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-sm">2</span>
              상세 준비 로드맵 & 마케팅 전략
            </h2>
            
            {output ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div className="flex gap-2">
                    <button 
                      onClick={downloadWord}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      DOC 다운로드
                    </button>
                    <button 
                      onClick={downloadMD}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      MD 다운로드
                    </button>
                  </div>
                </div>
                <div className="prose prose-slate prose-indigo max-w-none prose-headings:font-bold prose-h3:text-lg prose-p:text-slate-600 prose-li:text-slate-600 whitespace-pre-wrap">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{output}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-center">좌측에 분석 항목을 입력하고<br/>생성 버튼을 누르면 상세한 전략이 이곳에 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-slate-500 text-sm border-t border-slate-200 mt-12">
        <p>© 2026 혁신 트렌드 AI. Designed & Developed by 정혁신.</p>
      </footer>

      {/* API Key Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Google API Key 설정</h3>
              <p className="text-sm text-slate-500 mb-6">
                웹 배포 환경에서도 본인의 Gemini API Key를 입력하여 서비스를 이용할 수 있습니다. 키는 브라우저에만 안전하게 저장됩니다.
              </p>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-slate-700 mb-1">
                    API Key
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-sm"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveApiKey}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
