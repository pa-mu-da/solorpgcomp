
// --- Start of components/SaveLoadControls.js content ---
const SaveLoadControls = ({ onSave, onLoad, onReset, currentTheme, onThemeChange, onLoadGameDataPackage }) => {
  const sessionFileInputRef = React.useRef(null);
  const gameDataFileInputRef = React.useRef(null);
  const [showThemeDropdown, setShowThemeDropdown] = React.useState(false);

  const themeOptions = [
    { value: 'dark', label: 'ダーク' },
    { value: 'light', label: 'ライト' },
    { value: 'earth', label: 'アース' },
    { value: 'pastel', label: 'パステル' },
  ];

  const handleSessionFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onLoad(file);
      if(sessionFileInputRef.current) sessionFileInputRef.current.value = ''; 
    }
  };

  const triggerSessionLoad = () => {
    sessionFileInputRef.current?.click();
  };

  const handleGameDataFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onLoadGameDataPackage(file);
      if(gameDataFileInputRef.current) gameDataFileInputRef.current.value = ''; 
    }
  };

  const triggerGameDataLoad = () => {
    gameDataFileInputRef.current?.click();
  };
  
  const handleThemeSelect = (theme) => {
    onThemeChange(theme);
    setShowThemeDropdown(false);
  };

  return React.createElement('div', { className: "bg-secondary p-3 rounded-lg shadow-md flex flex-col gap-3" },
    React.createElement('div', { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 w-full" },
      React.createElement('h1', { className: "text-xl sm:text-2xl font-bold accent-teal-text" }, "Solo RPG Companion"),
      React.createElement('div', { className: "flex gap-2 sm:gap-3 items-center flex-wrap" }, 
        React.createElement('div', { className: "relative" },
          React.createElement('button', ({
            onClick: () => setShowThemeDropdown(!showThemeDropdown),
            className: "flex items-center gap-2 px-3 py-2 accent-purple-bg hover:bg-purple-500 text-white font-semibold rounded-md transition-colors text-sm",
            title: "テーマを変更"
          } as React.ButtonHTMLAttributes<HTMLButtonElement>),
            React.createElement(PaintBrushIcon, { className: "w-4 h-4 sm:w-5 sm:h-5" }), 
            React.createElement('span', {className: "hidden sm:inline"}, "テーマ")
          ),
          showThemeDropdown && React.createElement('div', { className: "absolute right-0 mt-2 w-40 bg-tertiary border border-primary rounded-md shadow-lg z-20" },
            themeOptions.map(option => (
              React.createElement('button', ({
                key: option.value,
                onClick: () => handleThemeSelect(option.value),
                className: `w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-tertiary-hover ${currentTheme === option.value ? 'accent-sky-text font-semibold' : 'text-primary'}`
              } as React.ButtonHTMLAttributes<HTMLButtonElement>),
                React.createElement('span', null, option.label),
                currentTheme === option.value && React.createElement(CheckIcon, { className: "w-4 h-4 accent-sky-text" })
              )
            ))
          )
        ),
        React.createElement('button', ({
          onClick: triggerGameDataLoad,
          className: "flex items-center gap-2 px-3 py-2 bg-slate-600 hover:bg-slate-500 text-white font-semibold rounded-md transition-colors text-sm",
          title: "ゲームデータパッケージを読み込む (.srgd)"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>),
          React.createElement(ArchiveBoxArrowDownIcon, { className: "w-4 h-4 sm:w-5 sm:h-5" }), 
           React.createElement('span', {className: "hidden md:inline"}, "データ読込")
        ),
        React.createElement('input', ({
          type: "file",
          accept: ".srgd,application/json", 
          ref: gameDataFileInputRef,
          onChange: handleGameDataFileChange,
          className: "hidden"
        } as React.InputHTMLAttributes<HTMLInputElement>)),
        React.createElement('button', ({
          onClick: onSave,
          className: "flex items-center gap-2 px-3 py-2 accent-blue-bg hover:bg-blue-500 text-white font-semibold rounded-md transition-colors text-sm",
          title: "作業内容をJSONファイルに保存"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>),
          React.createElement(SaveIcon, { className: "w-4 h-4 sm:w-5 sm:h-5" }), 
          React.createElement('span', {className: "hidden sm:inline"}, "保存")
        ),
        React.createElement('button', ({
          onClick: triggerSessionLoad,
          className: "flex items-center gap-2 px-3 py-2 accent-green-bg hover:bg-green-500 text-white font-semibold rounded-md transition-colors text-sm",
          title: "JSONファイルから作業内容を読み込む"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>),
          React.createElement(UploadIconFolder, { className: "w-4 h-4 sm:w-5 sm:h-5" }), 
          React.createElement('span', {className: "hidden sm:inline"}, "読込")
        ),
        React.createElement('input', ({
          type: "file",
          accept: ".json,application/json", 
          ref: sessionFileInputRef,
          onChange: handleSessionFileChange,
          className: "hidden"
        } as React.InputHTMLAttributes<HTMLInputElement>)),
        React.createElement('button', ({
          onClick: onReset,
          className: "flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-md transition-colors text-sm",
          title: "全てのデータをリセット"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>),
          React.createElement(RefreshIcon, { className: "w-4 h-4 sm:w-5 sm:h-5" }), React.createElement('span', {className: "hidden sm:inline"}, "リセット")
        )
      )
    )
  );
};
// --- End of components/SaveLoadControls.js content ---
