
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
console.log("index.js: Script execution started."); // Diagnostic log

import React, { useState, useCallback, useEffect, useRef, StrictMode, Fragment } from 'react';
import { createRoot } from 'react-dom/client';

import { PREDEFINED_COLORS, THEME_SPECIFIC_PLAYLOG_COLORS, THEME_EXPORT_PAGE_STYLES, DEFAULT_GAME_DATA_PACKAGE_STRUCTURE } from './constants.js';
import { 
    SaveIcon, UploadIcon, UploadIconFolder, PlusIcon, MinusIcon, TrashIcon, CubeIcon, UserCircleIcon, PlusCircleIcon,
    ChevronDownIcon, ChevronUpIcon, UndoIcon, RedoIcon, SendIcon, EditIcon, HeadingIcon, PaletteIcon, CheckIcon,
    CheckCircleIcon, KeyIcon, AlertTriangleIcon, PaintBrushIcon, DocumentArrowDownIcon, RefreshIcon,
    BookOpenIcon, ArchiveBoxArrowDownIcon, ArrowUturnLeftIcon
} from './components/Icons.js';

declare global {
  interface Window {
    jspdf: any;
    html2canvas: any;
  }
}

// --- Start of utils/diceUtils.js content ---

const parseAndRollDice = (command) => {
  const originalCommand = command.trim();
  const lowerCommand = originalCommand.toLowerCase();

  const fatePattern = /^(\d*)d[fF]$/;
  const standardPattern = /^(\d*)d(\d+)(?:([+\-])(\d+))?$/;

  let match = lowerCommand.match(fatePattern);
  if (match) {
    const numDiceStr = match[1];
    const numDice = numDiceStr ? parseInt(numDiceStr) : 1;

    if (numDice <= 0 || numDice > 100) {
      return { error: "ダイスの数は1から100の間でなければなりません。" };
    }
    
    const individualRolls = Array(numDice).fill(0).map(() => Math.floor(Math.random() * 3) - 1);
    const total = individualRolls.reduce((sum, roll) => sum + roll, 0);
    return { command: originalCommand, individualRolls, total };
  }

  match = lowerCommand.match(standardPattern);
  if (match) {
    const numDiceStr = match[1];
    const sidesStr = match[2];
    const operator = match[3];
    const modifierStr = match[4];

    const numDice = numDiceStr ? parseInt(numDiceStr) : 1;
    const sides = parseInt(sidesStr);
    const modifier = modifierStr ? parseInt(modifierStr) : 0;

    if (numDice <= 0 || numDice > 100) {
      return { error: "ダイスの数は1から100の間でなければなりません。" };
    }
    if (sides <= 1 || sides > 1000) {
      return { error: "ダイスの面は2から1000の間でなければなりません。" };
    }
    if (modifier < 0 || modifier > 1000 ) {
        return { error: "修正値は0から1000の間でなければなりません。"}
    }

    const individualRolls = Array(numDice).fill(0).map(() => Math.floor(Math.random() * sides) + 1);
    let total = individualRolls.reduce((sum, roll) => sum + roll, 0);

    if (operator === '+') {
      total += modifier;
    } else if (operator === '-') {
      total -= modifier;
    }
    return { command: originalCommand, individualRolls, total };
  }

  return { error: "無効なダイスコマンド形式です。例: 2d6, d20+3, 4dF" };
};
// --- End of utils/diceUtils.js content ---

// --- Start of utils/csvParser.js content ---
interface ParsedCSVEntry {
  rollValue?: string;
  value: string;
}
interface ParsedCSVResult {
  diceCommand: string | null;
  entries: ParsedCSVEntry[];
}

const parseCSV = (file: File): Promise<ParsedCSVResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result;
        if (typeof csvText !== 'string') {
          resolve({ diceCommand: null, entries: [] }); 
          return;
        }

        const lines = csvText.split(/\r\n|\n|\r/);
        let diceCommand = null;
        const parsedEntries: ParsedCSVEntry[] = [];
        let lineOffset = 0;

        if (lines.length > 0 && lines[0].toUpperCase().startsWith('#DICE:')) {
          diceCommand = lines[0].substring(6).trim();
          lineOffset = 1;
        }

        for (let i = lineOffset; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.length === 0) continue;

          if (diceCommand) {
            const parts = line.split(/,(.+)/); 
            if (parts.length >= 2) {
              parsedEntries.push({ rollValue: parts[0].trim(), value: parts[1].trim() });
            } else if (parts.length === 1 && parts[0].trim()) {
               parsedEntries.push({ value: parts[0].trim() }); 
            }
          } else {
            parsedEntries.push({ value: line });
          }
        }
        resolve({ diceCommand, entries: parsedEntries });
      } catch (error) {
        console.error("Error parsing CSV:", error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      reject(error);
    };
    reader.readAsText(file);
  });
};
// --- End of utils/csvParser.js content ---


// --- Start of components/LoadingSpinner.js content ---
const LoadingSpinner = ({ size = 'md', color = 'text-white' }) => {
  let sizeClasses = 'h-8 w-8';
  if (size === 'sm') sizeClasses = 'h-5 w-5';
  if (size === 'lg') sizeClasses = 'h-12 w-12';

  return (
    React.createElement('div', {
      className: `animate-spin rounded-full border-t-2 border-b-2 border-transparent ${sizeClasses} ${color}`,
      style: { borderTopColor: 'currentColor', borderBottomColor: 'currentColor', borderLeftColor: 'transparent', borderRightColor: 'transparent' },
      role: "status",
      'aria-label': "読み込み中"
    }, 
      React.createElement('span', { className: "sr-only" }, "読み込み中...")
    )
  );
};
// --- End of components/LoadingSpinner.js content ---

// --- Start of components/CharacterSheet.js content ---
const CharacterSheet = ({ data, onDataChange }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [localName, setLocalName] = React.useState(data.name);
  const [localStats, setLocalStats] = React.useState(data.stats || ''); 
  const [localCustomFields, setLocalCustomFields] = React.useState(data.customFields || []);

  React.useEffect(() => {
    setLocalName(data.name);
    setLocalStats(data.stats || '');
    setLocalCustomFields(Array.isArray(data.customFields) ? data.customFields.map(f => ({...f})) : []);
  }, [data.name, data.stats, data.customFields]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  };

  const handleNameBlur = () => {
    if (localName !== data.name) {
      onDataChange({ ...data, name: localName });
    }
  };

  const handleStatsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalStats(e.target.value);
  };

  const handleStatsBlur = () => {
    if (localStats !== (data.stats || '')) {
      onDataChange({ ...data, stats: localStats });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onDataChange({ ...data, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleAddCustomField = () => {
    const newField = {
      id: crypto.randomUUID(),
      fieldName: 'New Field',
      fieldValue: '',
    };
    const updatedFields = [...localCustomFields, newField];
    setLocalCustomFields(updatedFields);
    onDataChange({ ...data, customFields: updatedFields });
  };

  const handleDeleteCustomField = (fieldId) => {
    const updatedFields = localCustomFields.filter(field => field.id !== fieldId);
    setLocalCustomFields(updatedFields);
    onDataChange({ ...data, customFields: updatedFields });
  };

  const handleCustomFieldNameChange = (fieldId, newName) => {
    setLocalCustomFields(prevFields =>
      prevFields.map(field => (field.id === fieldId ? { ...field, fieldName: newName } : field))
    );
  };

  const handleCustomFieldValueChange = (fieldId, newValue) => {
    setLocalCustomFields(prevFields =>
      prevFields.map(field => (field.id === fieldId ? { ...field, fieldValue: newValue } : field))
    );
  };

  const handleCustomFieldBlur = (fieldId) => {
    const localField = localCustomFields.find(f => f.id === fieldId);
    const originalField = data.customFields?.find(f => f.id === fieldId);

    if (!localField) return;

    const nameChanged = localField.fieldName !== (originalField?.fieldName || '');
    const valueChanged = localField.fieldValue !== (originalField?.fieldValue || '');

    if (nameChanged || valueChanged) {
      onDataChange({ ...data, customFields: localCustomFields.map(f => ({...f})) });
    }
  };

  return React.createElement('div', { className: "bg-slate-800 p-3 sm:p-4 rounded-lg shadow-lg" },
    React.createElement('h3', { className: "text-lg sm:text-xl font-semibold mb-3 text-sky-400" }, "キャラクターシート"),
    React.createElement('div', { className: "space-y-3" },
      React.createElement('div', null,
        React.createElement('label', { htmlFor: "charName", className: "block text-sm font-medium text-slate-300 mb-1" }, "名前"),
        React.createElement('input', ({
          type: "text",
          id: "charName",
          name: "name",
          value: localName,
          onChange: handleNameChange,
          onBlur: handleNameBlur,
          placeholder: "キャラクター名",
          className: "w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-sm"
        } as React.InputHTMLAttributes<HTMLInputElement>))
      ),
      React.createElement('div', { className: "flex flex-col sm:flex-row gap-4 items-start" },
        React.createElement('div', { className: "flex-grow w-full sm:w-2/3" },
          React.createElement('label', { htmlFor: "charStats", className: "block text-sm font-medium text-slate-300 mb-1" }, data.statsLabel || "能力値・詳細"),
          React.createElement('textarea', ({
            id: "charStats",
            name: "stats",
            value: localStats,
            onChange: handleStatsChange,
            onBlur: handleStatsBlur,
            placeholder: "能力値、背景、特技など...",
            rows: 6,
            className: "w-full p-2 bg-slate-700 border border-slate-600 rounded-md resize-y focus:ring-1 focus:ring-sky-500 focus:border-sky-500 custom-scrollbar text-sm"
          } as React.TextareaHTMLAttributes<HTMLTextAreaElement>))
        ),
        React.createElement('div', { className: "w-full sm:w-1/3 flex flex-col items-center sm:items-end" }, 
          React.createElement('label', { className: "block text-sm font-medium text-slate-300 mb-1 self-start sm:self-auto" }, "画像"),
          React.createElement('div', { className: "w-full h-32 sm:h-40 bg-slate-700 border border-slate-600 rounded-md flex items-center justify-center overflow-hidden mb-2" },
            data.image ? (
              React.createElement('img', { src: data.image, alt: "Character", className: "max-w-full max-h-full object-contain" })
            ) : (
              React.createElement(UserCircleIcon, { className: "w-16 h-16 text-slate-500" })
            )
          ),
          React.createElement('input', ({
            type: "file",
            accept: "image/*",
            ref: fileInputRef,
            onChange: handleImageUpload,
            className: "hidden",
            'aria-label': "キャラクター画像アップロード"
          } as React.InputHTMLAttributes<HTMLInputElement>)),
          React.createElement('button', ({
            onClick: triggerImageUpload,
            className: "w-full flex items-center justify-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-md transition-colors"
          } as React.ButtonHTMLAttributes<HTMLButtonElement>),
            React.createElement(UploadIcon, { className: "w-4 h-4" }),
            "画像変更"
          )
        )
      ),
      React.createElement('div', { className: "mt-4 pt-3 border-t border-slate-700" },
        React.createElement('h4', { className: "text-md font-semibold text-slate-300 mb-2" }, "カスタム項目"),
        localCustomFields.length === 0 && React.createElement('p', {className: "text-sm text-slate-400"}, "カスタム項目はありません。「項目追加」ボタンで作成できます。"),
        localCustomFields.map((field) => (
          React.createElement('div', { key: field.id, className: "mb-3 p-2 border border-slate-700 rounded-md bg-slate-700/30" },
            React.createElement('div', { className: "flex justify-between items-center mb-1" },
              React.createElement('input', ({
                type: "text",
                value: field.fieldName,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleCustomFieldNameChange(field.id, e.target.value),
                onBlur: () => handleCustomFieldBlur(field.id),
                placeholder: "項目名",
                className: "flex-grow p-1 bg-slate-600 border border-slate-500 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-sm font-medium text-sky-300"
              } as React.InputHTMLAttributes<HTMLInputElement>)),
              React.createElement('button', ({
                onClick: () => handleDeleteCustomField(field.id),
                className: "ml-2 p-1 text-red-400 hover:text-red-300",
                title: "この項目を削除"
              } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(TrashIcon, { className: "w-4 h-4" }))
            ),
            React.createElement('textarea', ({
              value: field.fieldValue,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => handleCustomFieldValueChange(field.id, e.target.value),
              onBlur: () => handleCustomFieldBlur(field.id),
              placeholder: "内容...",
              rows: 3,
              className: "w-full p-2 bg-slate-600 border border-slate-500 rounded-md resize-y focus:ring-1 focus:ring-sky-500 focus:border-sky-500 custom-scrollbar text-sm"
            } as React.TextareaHTMLAttributes<HTMLTextAreaElement>))
          )
        )),
        React.createElement('button', ({
          onClick: handleAddCustomField,
          className: "mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-md transition-colors"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(PlusIcon, { className: "w-4 h-4" }), "項目追加")
      )
    )
  );
};
// --- End of components/CharacterSheet.js content ---

// --- Start of components/SaveLoadControls.js content ---
const SaveLoadControls = ({ onSave, onLoad, onReset, currentTheme, onThemeChange, onLoadGameDataPackage }) => {
  const sessionFileInputRef = React.useRef<HTMLInputElement>(null);
  const gameDataFileInputRef = React.useRef<HTMLInputElement>(null);
  const [showThemeDropdown, setShowThemeDropdown] = React.useState(false);

  const themeOptions = [
    { value: 'dark', label: 'ダーク' },
    { value: 'light', label: 'ライト' },
    { value: 'earth', label: 'アース' },
    { value: 'pastel', label: 'パステル' },
  ];

  const handleSessionFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onLoad(file);
      if(sessionFileInputRef.current) sessionFileInputRef.current.value = ''; 
    }
  };

  const triggerSessionLoad = () => {
    sessionFileInputRef.current?.click();
  };

  const handleGameDataFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    ),
    React.createElement('div', { className: "text-sm" }, 
      React.createElement('a', ({
        href: "./gamedatamaker.html",
        target: "_blank",
        rel: "noopener noreferrer",
        className: "accent-sky-text hover:underline",
        title: "ゲームデータ作成ツール (gamedatamaker.html) を開きます"
      } as React.AnchorHTMLAttributes<HTMLAnchorElement>), "ゲームデータ(SRGD)作成ツールはこちら")
    )
  );
};
// --- End of components/SaveLoadControls.js content ---

// --- Start of components/DiceRoller.js content ---
const DiceRoller = ({ diceRollHistory, setDiceRollHistory, addLogEntry }) => {
  const [diceCommand, setDiceCommand] = React.useState('1d20');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [isHistoryExpanded, setIsHistoryExpanded] = React.useState(false);

  const handleRollDice = React.useCallback(async () => {
    if (!diceCommand.trim()) {
      setError("ダイスコマンドを入力してください。");
      if (typeof addLogEntry === 'function') {
          addLogEntry("ダイスロール試行: コマンドが空です。", 'normal', 'yellow');
      } else {
          console.error("DiceRoller: addLogEntry is not a function (when command is empty).");
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    
    await new Promise(resolve => setTimeout(resolve, 50)); 

    const result = parseAndRollDice(diceCommand);

    if (typeof addLogEntry !== 'function') {
        console.error("DiceRoller: addLogEntry is not a function before processing roll result.");
        setError("内部エラー: ログ機能が利用できません。"); 
        setIsLoading(false);
        return;
    }

    if ('error' in result) {
      setError(result.error);
      addLogEntry(`ダイスロールエラー (${diceCommand}): ${result.error}`, 'normal', 'red');
    } else {
      const newRoll = {
        id: crypto.randomUUID(),
        command: result.command,
        individualRolls: result.individualRolls,
        total: result.total,
        timestamp: new Date().toISOString(),
      };

      setDiceRollHistory(prev => [newRoll, ...prev.slice(0, 19)]);
      addLogEntry(`ダイスロール (${newRoll.command}): ${newRoll.individualRolls.join(', ')} = ${newRoll.total}`);
    }
    setIsLoading(false);
  }, [diceCommand, addLogEntry, setDiceRollHistory, setError, setIsLoading]);


  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleRollDice().catch(err => {
        console.error("Error during dice roll execution:", err);
        setError("ダイスロール中に予期せぬエラーが発生しました。");
        setIsLoading(false); 
        if (typeof addLogEntry === 'function') {
            addLogEntry(`重大なダイスロールエラー: ${err.message || '不明なエラー'}`, 'normal', 'red');
        } else {
            console.error("DiceRoller: addLogEntry is not a function (during critical error handling).");
        }
    });
  };

  return React.createElement('div', { className: "bg-slate-800 p-3 sm:p-4 rounded-lg shadow-lg" },
    React.createElement('h3', { className: "text-lg sm:text-xl font-semibold mb-3 text-sky-400" }, "ダイスローラー"),
    React.createElement('form', { onSubmit: handleSubmit, className: "flex gap-2 mb-3" },
      React.createElement('input', ({
        type: "text",
        value: diceCommand,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDiceCommand(e.target.value),
        placeholder: "例: 2d6+3, 1d100, 4dF",
        className: "flex-1 p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-sm disabled:opacity-50",
        disabled: isLoading,
        'aria-label': "ダイスコマンド入力"
      } as React.InputHTMLAttributes<HTMLInputElement>)),
      React.createElement('button', ({
        type: "submit",
        className: "px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center",
        disabled: isLoading,
        title: "ダイスを振る",
        'aria-label': "ダイスを振る"
      } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        isLoading ? React.createElement(LoadingSpinner, { size: "sm" }) : React.createElement(React.Fragment, null, 
            React.createElement(CubeIcon, { className: "w-5 h-5 mr-1 sm:mr-2" }), 
            React.createElement('span', {className: "hidden sm:inline"}, "振る"), 
            React.createElement(SendIcon, {className: "w-4 h-4 sm:hidden"})
        )
      )
    ),
    error && React.createElement('div', { role: "alert", className: "mb-2 p-2 bg-red-900/50 border border-red-700 rounded-md text-red-300 text-xs flex items-start gap-2" },
      React.createElement(AlertTriangleIcon, { className: "w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" }),
      React.createElement('span', null, error)
    ),
    diceRollHistory.length > 0 && React.createElement('div', null,
      React.createElement('button', ({ 
        onClick: () => setIsHistoryExpanded(!isHistoryExpanded), 
        className: "text-sm text-slate-400 hover:text-slate-300 flex items-center gap-1 mb-1",
        'aria-expanded': isHistoryExpanded,
        'aria-controls': "dice-roll-history-list"
      } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        "ロール履歴 ", isHistoryExpanded ? React.createElement(ChevronUpIcon, { className: "w-4 h-4" }) : React.createElement(ChevronDownIcon, { className: "w-4 h-4" }), ` (${diceRollHistory.length})`
      ),
      isHistoryExpanded && React.createElement('div', { id: "dice-roll-history-list", className: "max-h-40 overflow-y-auto space-y-1 bg-slate-700/70 p-2 rounded custom-scrollbar text-xs" },
        diceRollHistory.map(roll => (
          React.createElement('div', { key: roll.id, className: "border-b border-slate-600 pb-1 mb-1 last:border-b-0 last:mb-0" },
            React.createElement('span', { className: "font-semibold text-teal-300" }, `${roll.command}: `),
            React.createElement('span', { className: "text-slate-200" }, roll.total),
            React.createElement('span', { className: "text-slate-400 ml-1" }, `(${roll.individualRolls.join(', ')})`),
            React.createElement('span', { className: "text-slate-500 text-xxs block" }, new Date(roll.timestamp).toLocaleTimeString())
          )
        ))
      )
    )
  );
};
// --- End of components/DiceRoller.js content ---

// --- Start of components/RandomTablesPanel.js content ---
const matchRollToEntry = (total: number, rollValueStr?: string): boolean => {
  if (!rollValueStr || rollValueStr.trim() === '') return false;

  const trimmedStr = rollValueStr.trim();
  const rangeMatch = trimmedStr.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return total >= min && total <= max;
  }
  const plusMatch = trimmedStr.match(/^(\d+)\+$/);
  if (plusMatch) {
    const min = parseInt(plusMatch[1], 10);
    return total >= min;
  }
  const minusMatch = trimmedStr.match(/^(\d+)-$/);
  if (minusMatch) {
    const max = parseInt(minusMatch[1], 10);
    return total <= max;
  }
  const exactMatch = trimmedStr.match(/^(\d+)$/);
  if (exactMatch) {
    const val = parseInt(exactMatch[1], 10);
    return total === val;
  }
  return false; 
};

const RandomTablesPanel = ({ tables, setTables, addLogEntry }) => {
  const [selectedTableId, setSelectedTableId] = React.useState(null);
  const [rollResult, setRollResult] = React.useState(null);
  const [rollDetails, setRollDetails] = React.useState(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [editingTableNameId, setEditingTableNameId] = React.useState(null);
  const [tableNameInput, setTableNameInput] = React.useState("");
  const [editingDiceCmdId, setEditingDiceCmdId] = React.useState(null);
  const [diceCmdInput, setDiceCmdInput] = React.useState("");
  const [editingEntry, setEditingEntry] = React.useState({ tableId: null, entryId: null, rollValue: '', value: '' });

  React.useEffect(() => {
    if (tables && tables.length > 0) {
      const currentSelectionExists = tables.some(t => t.id === selectedTableId);
      if (!selectedTableId || !currentSelectionExists) { 
        setSelectedTableId(tables[0].id);
        setRollResult(null); 
        setRollDetails(null);
        setEditingTableNameId(null);
        setEditingDiceCmdId(null);
        cancelEditEntry(); 
      }
    } else { 
      if (selectedTableId !== null) {
        setSelectedTableId(null);
        setRollResult(null); 
        setRollDetails(null);
        setEditingTableNameId(null); 
        setEditingDiceCmdId(null);
        cancelEditEntry();
      }
    }
  }, [tables, selectedTableId]); 

  React.useEffect(() => {
    const table = tables.find(t => t.id === selectedTableId);
    if (table) {
        if (editingTableNameId !== table.id) {
            setTableNameInput(table.name);
        }
        if (editingDiceCmdId !== table.id) {
            setDiceCmdInput(table.diceCommand || "");
        }
    } else {
        setTableNameInput("");
        setDiceCmdInput("");
        setEditingTableNameId(null); 
        setEditingDiceCmdId(null);
    }
  }, [selectedTableId, tables, editingTableNameId, editingDiceCmdId]);

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      parseCSV(file)
        .then((parsedData: ParsedCSVResult) => { 
          if (parsedData.entries.length === 0) {
            alert("CSVファイルが空か、有効なデータが含まれていません。");
            return;
          }
          const newTable = {
            id: crypto.randomUUID(),
            name: file.name.replace(/\.csv$/i, '') || `新規テーブル ${tables.length + 1}`,
            diceCommand: parsedData.diceCommand,
            entries: parsedData.entries.map((entry: ParsedCSVEntry) => ({ 
              id: crypto.randomUUID(),
              value: entry.value,
              rollValue: entry.rollValue,
            })),
          };
          setTables(prevTables => [...prevTables, newTable]);
          alert(`テーブル「${newTable.name}」がインポートされました。${parsedData.diceCommand ? `ダイスコマンド: ${parsedData.diceCommand}` : ''}`);
        })
        .catch(error => {
          console.error("CSVの解析に失敗しました:", error);
          alert(`CSVの解析に失敗しました: ${error.message}`);
        });
      if (event.target) event.target.value = ''; 
    }
  };

  const handleRollTable = () => {
    if (!selectedTableId) return;
    const table = tables.find(t => t.id === selectedTableId);
    if (!table || table.entries.length === 0) {
      setRollResult("テーブルが空か、選択されていません。");
      setRollDetails(null);
      return;
    }

    setRollResult(null);
    setRollDetails(null);
    
    if (typeof addLogEntry !== 'function') {
        console.error("RandomTablesPanel: addLogEntry is not a function.");
        setRollResult("内部エラー: ログ機能が利用できません。");
        return;
    }

    if (table.diceCommand) {
      const diceRoll = parseAndRollDice(table.diceCommand);
      if ('error' in diceRoll) { 
        setRollResult(`ダイスエラー: ${diceRoll.error}`);
        addLogEntry(`ランダムテーブル「${table.name}」ダイスエラー (${table.diceCommand}): ${diceRoll.error}`, 'normal', 'red');
        return;
      }

      const matchingEntries = table.entries.filter(entry => matchRollToEntry(diceRoll.total, entry.rollValue));
      
      if (matchingEntries.length > 0) {
        const resultEntry = matchingEntries[Math.floor(Math.random() * matchingEntries.length)];
        setRollDetails({
          command: table.diceCommand,
          rolls: diceRoll.individualRolls,
          total: diceRoll.total,
          resultValue: resultEntry.value
        });
        addLogEntry(`ランダムテーブル「${table.name}」 (${table.diceCommand} -> ${diceRoll.total}): ${resultEntry.value}`);
      } else {
        setRollDetails({
          command: table.diceCommand,
          rolls: diceRoll.individualRolls,
          total: diceRoll.total,
          resultValue: "該当なし"
        });
        addLogEntry(`ランダムテーブル「${table.name}」 (${table.diceCommand} -> ${diceRoll.total}): 該当なし`, 'normal', 'yellow');
      }
    } else {
      const randomIndex = Math.floor(Math.random() * table.entries.length);
      const result = table.entries[randomIndex].value;
      setRollResult(result);
      addLogEntry(`ランダムテーブル「${table.name}」の結果: ${result}`);
    }
  };

  const handleAddTable = () => {
    const newTableName = prompt("新しいテーブル名を入力してください:", `新規テーブル ${tables.length + 1}`);
    if (newTableName) {
      const newTable = {
        id: crypto.randomUUID(),
        name: newTableName,
        entries: [{ id: crypto.randomUUID(), value: "サンプル項目1", rollValue: "" }],
        diceCommand: ""
      };
      setTables(prev => [...prev, newTable]);
    }
  };

  const handleDeleteTable = (tableIdToDelete) => {
    // window.confirm removed based on previous feedback
    setTables(prev => prev.filter(t => t.id !== tableIdToDelete));
    // If the deleted table was selected, selectedTableId will be updated by the main useEffect
  };
  
  const startEditTableName = (table) => {
    setEditingTableNameId(table.id);
    setTableNameInput(table.name);
    setEditingDiceCmdId(null); 
    cancelEditEntry(); 
  };

  const handleTableNameBlur = (tableId) => {
    const currentTable = tables.find(t => t.id === tableId);
    if (tableNameInput.trim() === "") {
      alert("テーブル名は空にできません。");
      if (currentTable) setTableNameInput(currentTable.name); 
      return;
    }
    if (currentTable && tableNameInput.trim() !== currentTable.name) {
        setTables(prev => prev.map(t => t.id === tableId ? { ...t, name: tableNameInput.trim() } : t));
    }
  };
  
  const saveTableNameAndExitEdit = (tableId) => {
    if (tableNameInput.trim() === "") {
        alert("テーブル名は空にできません。");
        return;
    }
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, name: tableNameInput.trim() } : t));
    setEditingTableNameId(null);
  }
  
  const cancelEditTableName = () => {
    const table = tables.find(t => t.id === editingTableNameId);
    if (table) setTableNameInput(table.name);
    setEditingTableNameId(null);
  };

  const startEditDiceCmd = (table) => {
    setEditingDiceCmdId(table.id);
    setDiceCmdInput(table.diceCommand || "");
    setEditingTableNameId(null); 
    cancelEditEntry(); 
  };
  
  const handleDiceCmdBlur = (tableId) => {
    const currentTable = tables.find(t => t.id === tableId);
    if (currentTable && diceCmdInput.trim() !== (currentTable.diceCommand || "")) {
        setTables(prev => prev.map(t => t.id === tableId ? { ...t, diceCommand: diceCmdInput.trim() } : t));
    }
  };

  const saveDiceCmdAndExitEdit = (tableId) => {
     setTables(prev => prev.map(t => t.id === tableId ? { ...t, diceCommand: diceCmdInput.trim() } : t));
    setEditingDiceCmdId(null);
  }

  const cancelEditDiceCmd = () => {
    const table = tables.find(t => t.id === editingDiceCmdId);
    if (table) setDiceCmdInput(table.diceCommand || "");
    setEditingDiceCmdId(null);
  };

  const handleAddEntry = (tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    let newRollValue = "";
    let newValue = "新しい項目";

    if (table.diceCommand) {
        const rollVal = prompt("新しい項目の出目/範囲を入力してください (例: 7, 2-5, 10+):");
        if (rollVal === null) return;
        newRollValue = rollVal;
        const val = prompt("新しい項目の内容を入力してください:");
        if (val === null) return;
        newValue = val;
    } else {
        const val = prompt("新しい項目を入力してください:");
        if (val === null) return;
        newValue = val;
    }
    
    setTables(prev => prev.map(t => {
      if (t.id === tableId) {
        const newEntry = { 
            id: crypto.randomUUID(), 
            value: newValue, 
            rollValue: newRollValue || undefined 
        };
        return { ...t, entries: [...t.entries, newEntry] };
      }
      return t;
    }));
  };

  const startEditEntry = (tableId, entry) => {
    setEditingEntry({ tableId, entryId: entry.id, rollValue: entry.rollValue || '', value: entry.value });
    setEditingTableNameId(null); 
    setEditingDiceCmdId(null);
  };

  const handleEditingEntryChange = (field: 'rollValue' | 'value', value: string) => {
    setEditingEntry(prev => ({ ...prev, [field]: value }));
  };
  
  const saveEditEntry = () => {
    if (!editingEntry.tableId || !editingEntry.entryId) return;
    if (editingEntry.value.trim() === "") {
        alert("項目内容は空にできません。");
        return;
    }
    const table = tables.find(t => t.id === editingEntry.tableId);
    if (table && table.diceCommand && editingEntry.rollValue.trim() === "") {
        alert("ダイスコマンドが設定されているテーブルでは、出目/範囲は空にできません。");
        return;
    }

    setTables(prev => prev.map(t => {
      if (t.id === editingEntry.tableId) {
        return { 
          ...t, 
          entries: t.entries.map(e => 
            e.id === editingEntry.entryId 
            ? { ...e, value: editingEntry.value.trim(), rollValue: editingEntry.rollValue.trim() || undefined } 
            : e
          ) 
        };
      }
      return t;
    }));
    setEditingEntry({ tableId: null, entryId: null, rollValue: '', value: '' });
  };
  
  const cancelEditEntry = () => {
    setEditingEntry({ tableId: null, entryId: null, rollValue: '', value: '' });
  };

  const handleDeleteEntry = (tableId, entryId) => {
    // window.confirm removed based on previous feedback
    setTables(prev => prev.map(t => {
        if (t.id === tableId) {
        return { ...t, entries: t.entries.filter(e => e.id !== entryId) };
        }
        return t;
    }));
  };

  const selectedTable = tables.find(t => t.id === selectedTableId);

  return React.createElement('div', { className: "bg-slate-800 p-3 sm:p-4 rounded-lg shadow-lg" },
    React.createElement('h3', { className: "text-lg sm:text-xl font-semibold mb-3 text-sky-400" }, "ランダムテーブル"),
    React.createElement('div', { className: "flex gap-2 mb-3" },
      React.createElement('button', ({
        onClick: () => fileInputRef.current?.click(),
        className: "flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium rounded-md transition-colors"
      } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        React.createElement(UploadIcon, { className: "w-4 h-4" }), " CSVインポート"
      ),
      React.createElement('input', ({ type: "file", accept: ".csv", ref: fileInputRef, onChange: handleImportCSV, className: "hidden" } as React.InputHTMLAttributes<HTMLInputElement>)),
      React.createElement('button', ({
        onClick: handleAddTable,
        className: "px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-md transition-colors",
        title: "新しいテーブルを追加"
      } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        React.createElement(PlusIcon, { className: "w-4 h-4" })
      )
    ),
    tables.length > 0 && React.createElement('div', { className: "mb-3" },
      React.createElement('label', { htmlFor: "tableSelect", className: "block text-sm font-medium text-slate-300 mb-1" }, "テーブル選択"),
      React.createElement('select', ({
        id: "tableSelect",
        value: selectedTableId || '',
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => { 
            const newSelectedId = e.target.value;
            setSelectedTableId(newSelectedId); 
        },
        className: "w-full p-2 bg-slate-700 border border-slate-600 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-sm"
      } as React.SelectHTMLAttributes<HTMLSelectElement>),
        tables.map(table => React.createElement('option', { key: table.id, value: table.id }, table.name))
      )
    ),
    selectedTable && React.createElement('div', { className: "mb-3 p-2 border border-slate-700 rounded-md" },
      React.createElement('div', { className: "flex justify-between items-center mb-1" },
        editingTableNameId === selectedTable.id ? (
            React.createElement('div', {className: "flex items-center gap-1 w-full"},
                React.createElement('input', ({ 
                    type: "text", 
                    value: tableNameInput, 
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTableNameInput(e.target.value),
                    onBlur: () => handleTableNameBlur(selectedTable.id),
                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' ? saveTableNameAndExitEdit(selectedTable.id) : e.key === 'Escape' ? cancelEditTableName() : null,
                    className: "flex-grow text-md font-semibold bg-slate-600 text-sky-300 focus:ring-1 focus:ring-sky-500 rounded px-1 py-0.5",
                    autoFocus: true
                } as React.InputHTMLAttributes<HTMLInputElement>)),
                React.createElement('button', ({ onClick: () => saveTableNameAndExitEdit(selectedTable.id), className: "p-1 text-green-400 hover:text-green-300", title: "保存"} as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(SaveIcon, {className: "w-4 h-4"})),
            )
        ) : (
            React.createElement('h4', ({ 
                className: "text-md font-semibold text-sky-300 cursor-pointer hover:bg-slate-600 px-1 py-0.5 rounded truncate",
                onClick: () => startEditTableName(selectedTable),
                title: `テーブル名を編集: ${selectedTable.name}`
            } as React.HTMLAttributes<HTMLHeadingElement>), selectedTable.name)
        ),
        React.createElement('button', ({
            onClick: () => handleDeleteTable(selectedTable.id),
            className: "p-1 text-red-400 hover:text-red-300 ml-2 flex-shrink-0",
            title: "このテーブルを削除"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>),
            React.createElement(TrashIcon, { className: "w-4 h-4" })
        )
      ),
      React.createElement('div', { className: "flex items-center gap-2 mb-2 text-xs" },
        React.createElement('span', {className: "text-slate-400"}, "ダイスコマンド:"),
        editingDiceCmdId === selectedTable.id ? (
            React.createElement('div', {className: "flex items-center gap-1 w-full"},
                React.createElement('input', ({ 
                    type: "text", 
                    value: diceCmdInput, 
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDiceCmdInput(e.target.value),
                    onBlur: () => handleDiceCmdBlur(selectedTable.id),
                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' ? saveDiceCmdAndExitEdit(selectedTable.id) : e.key === 'Escape' ? cancelEditDiceCmd() : null,
                    className: "flex-grow bg-slate-600 text-slate-200 focus:ring-1 focus:ring-sky-500 rounded px-1 py-0.5 text-xs",
                    placeholder: "例: 2d6, 1d100+10",
                    autoFocus: true
                } as React.InputHTMLAttributes<HTMLInputElement>)),
                 React.createElement('button', ({ onClick: () => saveDiceCmdAndExitEdit(selectedTable.id), className: "p-1 text-green-400 hover:text-green-300", title: "保存"} as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(SaveIcon, {className: "w-3 h-3"})),
            )
        ) : (
             React.createElement('span', ({
                className: `text-slate-200 cursor-pointer hover:bg-slate-600 px-1 py-0.5 rounded truncate ${!selectedTable.diceCommand ? 'italic text-slate-500' : ''}`,
                onClick: () => startEditDiceCmd(selectedTable),
                title: "ダイスコマンドを編集"
             } as React.HTMLAttributes<HTMLSpanElement>), selectedTable.diceCommand || "設定なし (項目数でロール)")
        )
      ),
      React.createElement('div', { className: "max-h-48 overflow-y-auto custom-scrollbar space-y-1 pr-1 mb-2" },
        selectedTable.entries.map((entry) => (
          editingEntry.tableId === selectedTable.id && editingEntry.entryId === entry.id ? (
            React.createElement('div', { key: entry.id, className: "p-1.5 bg-slate-500 rounded" },
              selectedTable.diceCommand && React.createElement('input', ({
                type: "text",
                value: editingEntry.rollValue,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleEditingEntryChange('rollValue', e.target.value),
                placeholder: "出目/範囲",
                className: "w-full p-1 text-xs bg-slate-600 border border-slate-400 rounded-sm focus:ring-1 focus:ring-sky-500 mb-1"
              } as React.InputHTMLAttributes<HTMLInputElement>)),
              React.createElement('textarea', ({
                value: editingEntry.value,
                onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => handleEditingEntryChange('value', e.target.value),
                placeholder: "項目内容",
                className: "w-full p-1 text-xs bg-slate-600 border border-slate-400 rounded-sm focus:ring-1 focus:ring-sky-500 resize-y custom-scrollbar",
                rows: Math.max(1, editingEntry.value.split('\n').length)
              } as React.TextareaHTMLAttributes<HTMLTextAreaElement>)),
              React.createElement('div', {className: "flex gap-1 mt-1"},
                React.createElement('button', ({onClick: saveEditEntry, className: "px-2 py-0.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded"} as React.ButtonHTMLAttributes<HTMLButtonElement>), "保存"),
                React.createElement('button', ({onClick: cancelEditEntry, className: "px-2 py-0.5 text-xs bg-slate-600 hover:bg-slate-400 text-white rounded"} as React.ButtonHTMLAttributes<HTMLButtonElement>), "キャンセル")
              )
            )
          ) : (
            React.createElement('div', { key: entry.id, className: "flex items-start gap-1 group p-0.5 hover:bg-slate-600/50 rounded" },
              selectedTable.diceCommand && React.createElement('span', { 
                  className: "w-16 text-left text-xs text-slate-400 p-1 border border-transparent rounded-sm truncate flex-shrink-0",
                  title: entry.rollValue 
              }, entry.rollValue || '-'),
              React.createElement('span', { 
                  className: "flex-grow p-1 text-xs text-slate-200 whitespace-pre-wrap break-words border border-transparent rounded-sm",
                  style: { overflowWrap: 'anywhere', wordBreak: 'break-all' } 
              }, entry.value),
              React.createElement('div', { className: "flex flex-col items-center opacity-20 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" },
                React.createElement('button', ({ 
                    onClick: () => startEditEntry(selectedTable.id, entry),
                    className: "p-0.5 text-sky-400 hover:text-sky-300",
                    title: "この項目を編集"
                } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(EditIcon, { className: "w-3 h-3" })),
                React.createElement('button', ({
                    onClick: () => handleDeleteEntry(selectedTable.id, entry.id),
                    className: "p-0.5 text-red-500 hover:text-red-400",
                    title: "この項目を削除"
                } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(TrashIcon, { className: "w-3 h-3" }))
              )
            )
          )
        ))
      ),
      React.createElement('button', ({
        onClick: () => handleAddEntry(selectedTable.id),
        className: "mt-1 w-full flex items-center justify-center gap-1 px-2 py-1 bg-sky-700 hover:bg-sky-600 text-white text-xs font-medium rounded-md transition-colors"
      } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        React.createElement(PlusIcon, { className: "w-3 h-3" }), " 項目追加"
      )
    ),
    selectedTable && React.createElement('button', ({
      onClick: handleRollTable,
      disabled: !selectedTableId || !selectedTable || selectedTable.entries.length === 0,
      className: "w-full flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    } as React.ButtonHTMLAttributes<HTMLButtonElement>),
      React.createElement(CubeIcon, { className: "w-5 h-5" }), ` ${selectedTable ? `「${selectedTable.name}」を振る` : "テーブルを振る"}`
    ),
    (rollResult || rollDetails) && React.createElement('div', { className: "mt-3 p-2 bg-slate-700 rounded-md" },
      React.createElement('p', { className: "text-sm text-slate-300" }, "結果:"),
      rollDetails ? (
        React.createElement('div', null,
          React.createElement('p', { className: "text-xs text-slate-400" }, 
            `${rollDetails.command} -> ロール: ${rollDetails.rolls.join(', ')} = 合計: ${rollDetails.total}`
          ),
          React.createElement('p', { className: "font-semibold text-teal-300 text-md whitespace-pre-wrap break-words" }, rollDetails.resultValue)
        )
      ) : (
        React.createElement('p', { className: "font-semibold text-teal-300 text-md whitespace-pre-wrap break-words" }, rollResult)
      )
    ),
    tables.length === 0 && React.createElement('p', { className: "text-sm text-slate-400 text-center mt-2" }, "テーブルがありません。CSVをインポートするか、新規作成してください。")
  );
};
// --- End of components/RandomTablesPanel.js content ---

// --- Start of components/ResourceTrackerPanel.js content ---
const ResourceTrackerItem = ({ tracker, onReflectChange, onDelete, onNameChange, isActive, setActiveTracker }) => {
  const [stagedValue, setStagedValue] = React.useState(String(tracker.value)); 
  const [stagedReason, setStagedReason] = React.useState('');
  const [nameInput, setNameInput] = React.useState(tracker.name);
  const [isExpanded, setIsExpanded] = React.useState(false);

  const prevIsActive = React.useRef(isActive);
  const prevTrackerValue = React.useRef(tracker.value);
  const prevTrackerName = React.useRef(tracker.name);


  React.useEffect(() => {
    const trackerValueStr = String(tracker.value);
    if (tracker.name !== nameInput || prevTrackerName.current !== tracker.name) {
      setNameInput(tracker.name);
    }
    if (trackerValueStr !== stagedValue || prevTrackerValue.current !== tracker.value) {
      setStagedValue(trackerValueStr);
    }
    if (prevIsActive.current !== isActive) {
      setStagedReason('');
    }
    prevIsActive.current = isActive;
    prevTrackerValue.current = tracker.value;
    prevTrackerName.current = tracker.name;
  }, [tracker.value, tracker.name, isActive, nameInput, stagedValue]);


  const handleStageChange = (change) => {
    if (!isActive) setActiveTracker(tracker.id);
    const currentNumericValue = parseFloat(stagedValue);
    const baseValue = isNaN(currentNumericValue) ? 0 : currentNumericValue;
    setStagedValue(String(baseValue + change));
  };

  const handleReflect = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    
    let finalNumericValue;
    const trimmedReason = stagedReason.trim();

    if (typeof stagedValue === 'string' && stagedValue.trim() === '') {
      finalNumericValue = tracker.value; 
    } else {
      finalNumericValue = parseFloat(stagedValue); 
      if (isNaN(finalNumericValue)) {
        alert(`「${stagedValue}」は有効な数値ではありません。元の値 (${tracker.value}) を使用します。`);
        setStagedValue(String(tracker.value)); 
        finalNumericValue = tracker.value;
      }
    }

    const valueActuallyChanged = finalNumericValue !== tracker.value;
    const reasonActuallyProvided = trimmedReason !== '';

    if (valueActuallyChanged || reasonActuallyProvided) {
      onReflectChange(tracker.id, finalNumericValue, trimmedReason);
    }
  };
  
  const handleNameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isActive) setActiveTracker(tracker.id);
    setNameInput(e.target.value);
  };

  const handleNameInputBlur = () => {
    if (nameInput.trim() && nameInput !== tracker.name) {
        onNameChange(tracker.id, nameInput.trim());
    } else if (!nameInput.trim() && tracker.name) { 
        setNameInput(tracker.name); 
    } else if (!nameInput.trim() && !tracker.name) { 
        setNameInput(''); 
    }
  };
  
  const handleNameInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        e.currentTarget.blur(); 
    } else if (e.key === 'Escape') {
        setNameInput(tracker.name); 
        (e.currentTarget as HTMLInputElement).blur();
    }
  };

  let numericStagedValueForComparison;
  if (typeof stagedValue === 'string' && stagedValue.trim() === '') {
    numericStagedValueForComparison = tracker.value; 
  } else {
    numericStagedValueForComparison = parseFloat(stagedValue);
    if (isNaN(numericStagedValueForComparison)) {
      numericStagedValueForComparison = tracker.value;
    }
  }
  const hasStagedChanges = (numericStagedValueForComparison !== tracker.value) || stagedReason.trim() !== '';


  return React.createElement('div', { 
      className: `p-3 rounded-md shadow transition-all duration-200 ${isActive ? 'bg-slate-600 ring-2 ring-sky-500' : 'bg-slate-700 hover:bg-slate-600/70'}`,
      onClick: (e) => { e.stopPropagation(); if (!isActive) setActiveTracker(tracker.id); } 
    },
    React.createElement('div', { className: "flex items-center justify-between mb-2" },
      React.createElement('input', ({ 
          type: "text", 
          value: nameInput,
          onChange: handleNameInputChange,
          onBlur: handleNameInputBlur,
          onKeyDown: handleNameInputKeyDown,
          className: "text-md font-semibold bg-transparent text-sky-300 focus:ring-1 focus:ring-sky-500 rounded px-1 py-0.5 w-2/3 truncate",
          placeholder: "リソース名",
          onClick: (e) => e.stopPropagation() 
      } as React.InputHTMLAttributes<HTMLInputElement>)),
      React.createElement('button', ({ 
          onClick: (e) => {e.stopPropagation(); onDelete(tracker.id)}, 
          className: "p-1 text-red-400 hover:text-red-300", 
          title: "このトラッカーを削除" 
      } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        React.createElement(TrashIcon, { className: "w-4 h-4" })
      )
    ),
    React.createElement('div', { className: "flex items-center gap-2 mb-2" },
      React.createElement('button', ({ 
          onClick: (e) => {e.stopPropagation(); handleStageChange(-1)}, 
          className: "p-2 bg-red-600 hover:bg-red-500 rounded-md text-white disabled:opacity-60"
      } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(MinusIcon, { className: "w-4 h-4" })),
      
      React.createElement('input', ({
          type: "text", 
          inputMode: "numeric", 
          pattern: "-?[0-9]*(\\.[0-9]*)?",
          value: stagedValue, 
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            e.stopPropagation();
            if (!isActive) setActiveTracker(tracker.id);
            setStagedValue(e.target.value); 
          },
          onClick: (e) => e.stopPropagation(), 
          className: "text-xl font-bold text-center w-16 tabular-nums bg-slate-600 text-primary rounded border border-slate-500 focus:ring-1 focus:ring-sky-500 px-1"
        } as React.InputHTMLAttributes<HTMLInputElement>)),

      React.createElement('button', ({ 
          onClick: (e) => {e.stopPropagation(); handleStageChange(1)}, 
          className: "p-2 bg-green-600 hover:bg-green-500 rounded-md text-white disabled:opacity-60"
      } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(PlusIcon, { className: "w-4 h-4" }))
    ),
    React.createElement('input', ({
      type: "text",
      value: stagedReason,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => { e.stopPropagation(); if(!isActive) setActiveTracker(tracker.id); setStagedReason(e.target.value);},
      placeholder: "変更理由 (任意)",
      className: "w-full p-1.5 bg-slate-600 border border-slate-500 rounded-md text-sm mb-2 focus:ring-1 focus:ring-sky-500 disabled:bg-slate-700",
      onClick: (e) => e.stopPropagation()
    } as React.InputHTMLAttributes<HTMLInputElement>)),
    isActive && hasStagedChanges && React.createElement('button', ({ 
        onClick: handleReflect,
        className: "w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-md transition-colors text-sm mb-2"
    } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        React.createElement(CheckCircleIcon, { className: "w-4 h-4" }), " 反映"
    ),
    tracker.history.length > 0 && React.createElement('button', ({ 
        onClick: (e) => {e.stopPropagation(); setIsExpanded(!isExpanded)}, 
        className: "text-xs text-slate-400 hover:text-slate-300 flex items-center gap-1 mb-1 w-full justify-start" 
    } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        "履歴 ", isExpanded ? React.createElement(ChevronUpIcon, { className: "w-3 h-3" }) : React.createElement(ChevronDownIcon, { className: "w-3 h-3" }), ` (${tracker.history.length})`
    ),
    isExpanded && tracker.history.length > 0 && React.createElement('div', { className: "max-h-24 overflow-y-auto text-xs space-y-1 bg-slate-600/50 p-1.5 rounded custom-scrollbar" },
      tracker.history.slice().reverse().map(log => (
        React.createElement('div', { key: log.id, className: "text-slate-300" },
          React.createElement('span', null, `${new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}: ${log.previousValue} → ${log.newValue} (${log.change > 0 ? '+' : ''}${log.change})`),
          log.reason && React.createElement('span', { className: "italic text-slate-400" }, ` - ${log.reason}`)
        )
      ))
    )
  );
};

const ResourceTrackerPanel = ({ trackers, setTrackers: onSetTrackersProp, addLogEntry }) => {
  const [newTrackerName, setNewTrackerName] = React.useState('');
  const [newTrackerInitialValue, setNewTrackerInitialValue] = React.useState(0);
  const [activeTrackerId, setActiveTrackerId] = React.useState(null);

  const handleAddTracker = () => {
    if (!newTrackerName.trim()) {
      alert("トラッカー名を入力してください。");
      return;
    }
    const initialValue = Number(newTrackerInitialValue);
    if (isNaN(initialValue)) {
        alert("初期値は数値で入力してください。");
        return;
    }

    const newTracker = {
      id: crypto.randomUUID(),
      name: newTrackerName.trim(),
      value: initialValue,
      history: [],
    };

    if (typeof onSetTrackersProp === 'function') {
      onSetTrackersProp(prev => [...prev, newTracker]);
    } else {
      console.error("Error: onSetTrackersProp prop is not a function in ResourceTrackerPanel.handleAddTracker");
    }

    setNewTrackerName('');
    setNewTrackerInitialValue(0);
    setActiveTrackerId(newTracker.id); 
  };

  const handleReflectTrackerChange = (id, newValueFromItem, reason) => {
    const currentTracker = trackers.find(t => t.id === id);
    if (!currentTracker) return;

    if (typeof addLogEntry !== 'function') {
        console.error("ResourceTrackerPanel: addLogEntry is not a function.");
        alert("内部エラー: 変更をログに記録できませんでした。");
        return;
    }

    const previousValue = currentTracker.value;
    const newValue = newValueFromItem;
    const changeAmount = newValue - previousValue;
    const trackerName = currentTracker.name || "名称未設定トラッカー";
    const trimmedReason = reason.trim();

    const logEntryForInternalHistory = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        change: changeAmount,
        previousValue: previousValue,
        newValue: newValue,
        reason: trimmedReason,
    };

    const newTrackersArray = trackers.map(t => {
        if (t.id === id) {
            return { ...t, value: newValue, history: [logEntryForInternalHistory, ...t.history.slice(0, 49)] };
        }
        return t;
    });

    const valueActuallyChanged = newValue !== previousValue;
    const reasonActuallyProvided = trimmedReason !== '';
    const shouldLogToPlayLog = valueActuallyChanged || reasonActuallyProvided;

    if (shouldLogToPlayLog) {
        let logMessage = '';
        if (valueActuallyChanged) {
            logMessage = `リソース「${trackerName}」変更: ${previousValue} → ${newValue} (${changeAmount > 0 ? '+' : ''}${changeAmount})${trimmedReason ? ` 理由: ${trimmedReason}` : ''}`;
        } else { 
            logMessage = `リソース「${trackerName}」確認: ${newValue}${trimmedReason ? ` 理由: ${trimmedReason}` : ''}`;
        }
        addLogEntry(logMessage, 'normal', 'default', { resourceTrackers: newTrackersArray });
    } else {
        const trackersReallyChanged = JSON.stringify(newTrackersArray) !== JSON.stringify(trackers);
        if (trackersReallyChanged) {
            if (typeof onSetTrackersProp === 'function') {
                onSetTrackersProp(newTrackersArray);
            } else {
                console.error("Error: onSetTrackersProp prop is not a function in ResourceTrackerPanel.handleReflectTrackerChange (no play log entry)");
            }
        }
    }
    setActiveTrackerId(null); 
  };

  const handleDeleteTracker = (id) => {
    const trackerToDelete = trackers.find(t => t.id === id);
    if (!trackerToDelete) return;
    const trackerName = trackerToDelete.name || "不明なトラッカー";

    const newTrackersArray = trackers.filter(t => t.id !== id);

    if (typeof addLogEntry === 'function') {
        addLogEntry(
            `リソーストラッカー「${trackerName}」を削除しました。`,
            'normal',
            'yellow',
            { resourceTrackers: newTrackersArray }
        );
    } else {
         console.error("ResourceTrackerPanel: addLogEntry is not a function (during delete).");
         if (typeof onSetTrackersProp === 'function') {
            onSetTrackersProp(newTrackersArray);
         }
    }

    if (activeTrackerId === id) {
        setActiveTrackerId(null);
    }
  };

  const handleTrackerNameChange = (id, newName) => {
    const currentTracker = trackers.find(t => t.id === id);
    const oldName = currentTracker ? currentTracker.name : ""; 

    if (oldName === newName) return; 

    if (typeof onSetTrackersProp === 'function') {
      onSetTrackersProp(prev => prev.map(t => t.id === id ? { ...t, name: newName } : t));
    } else {
      console.error("Error: onSetTrackersProp prop is not a function in ResourceTrackerPanel.handleTrackerNameChange");
    }
  };

  return React.createElement('div', { className: "bg-slate-800 p-3 sm:p-4 rounded-lg shadow-lg", onClick: () => setActiveTrackerId(null) },
    React.createElement('h3', { className: "text-lg sm:text-xl font-semibold mb-3 text-sky-400" }, "リソーストラッカー"),
    React.createElement('div', { className: "space-y-3 mb-4" },
      trackers.map(tracker => (
        React.createElement(ResourceTrackerItem, {
          key: tracker.id,
          tracker: tracker,
          onReflectChange: handleReflectTrackerChange,
          onDelete: handleDeleteTracker,
          onNameChange: handleTrackerNameChange,
          isActive: activeTrackerId === tracker.id,
          setActiveTracker: setActiveTrackerId
        })
      ))
    ),
    React.createElement('div', { className: "bg-slate-700 p-3 rounded-md" },
      React.createElement('h4', { className: "text-md font-semibold mb-2 text-sky-300" }, "新規トラッカー追加"),
      React.createElement('input', ({
        type: "text",
        value: newTrackerName,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewTrackerName(e.target.value),
        placeholder: "リソース名 (例: HP, MP)",
        className: "w-full p-2 bg-slate-600 border border-slate-500 rounded-md text-sm mb-2 focus:ring-1 focus:ring-sky-500"
      } as React.InputHTMLAttributes<HTMLInputElement>)),
      React.createElement('input', ({
        type: "number",
        value: newTrackerInitialValue,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNewTrackerInitialValue(e.target.value === '' ? 0 : Number(e.target.value)),
        placeholder: "初期値 (例: 10)",
        className: "w-full p-2 bg-slate-600 border border-slate-500 rounded-md text-sm mb-2 focus:ring-1 focus:ring-sky-500"
      } as React.InputHTMLAttributes<HTMLInputElement>)),
      React.createElement('button', ({
        onClick: handleAddTracker,
        className: "w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-md transition-colors"
      } as React.ButtonHTMLAttributes<HTMLButtonElement>),
        React.createElement(PlusCircleIcon, { className: "w-5 h-5" }), " 追加"
      )
    ),
    trackers.length === 0 && React.createElement('p', { className: "text-sm text-slate-400 text-center mt-2" }, "トラッカーがありません。")
  );
};
// --- End of components/ResourceTrackerPanel.js content ---

// --- Start of components/RulebookPanel.js content ---
const RulebookPanel = ({ rulebookSections }) => {
  const [selectedSectionId, setSelectedSectionId] = React.useState('');
  const [searchText, setSearchText] = React.useState('');

  React.useEffect(() => {
    if (rulebookSections && rulebookSections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(rulebookSections[0].id);
    } else if ((!rulebookSections || rulebookSections.length === 0) && selectedSectionId) {
      setSelectedSectionId('');
    }
  }, [rulebookSections, selectedSectionId]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value.toLowerCase());
  };

  const filteredSections = React.useMemo(() => {
    if (!rulebookSections) return [];
    if (!searchText) return rulebookSections;
    return rulebookSections.filter(section => 
      section.title.toLowerCase().includes(searchText) || 
      section.content.toLowerCase().includes(searchText)
    );
  }, [rulebookSections, searchText]);
  
  const selectedSection = React.useMemo(() => {
    if (!selectedSectionId || !rulebookSections) return null;
    return rulebookSections.find(s => s.id === selectedSectionId);
  }, [selectedSectionId, rulebookSections]);


  if (!rulebookSections || rulebookSections.length === 0) {
    return React.createElement('div', { className: "bg-slate-800 p-3 sm:p-4 rounded-lg shadow-lg" },
      React.createElement('h3', { className: "text-lg sm:text-xl font-semibold mb-3 text-sky-400" }, "ルールブック"),
      React.createElement('p', { className: "text-sm text-slate-400" }, "利用可能なルールブックデータがありません。")
    );
  }
  
  return React.createElement('div', { className: "bg-slate-800 p-3 sm:p-4 rounded-lg shadow-lg flex flex-col h-full" },
    React.createElement('h3', { className: "text-lg sm:text-xl font-semibold mb-3 text-sky-400" }, "ルールブック"),
    React.createElement('input', ({
      type: "search",
      placeholder: "ルールを検索...",
      value: searchText,
      onChange: handleSearchChange,
      className: "w-full p-2 mb-3 bg-slate-700 border border-slate-600 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-sm"
    } as React.InputHTMLAttributes<HTMLInputElement>)),
    filteredSections.length > 0 && React.createElement('select', ({
      value: selectedSectionId,
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedSectionId(e.target.value),
      className: "w-full p-2 mb-3 bg-slate-700 border border-slate-600 rounded-md focus:ring-1 focus:ring-sky-500 focus:border-sky-500 text-sm custom-scrollbar",
      'aria-label': "ルールセクション選択"
    } as React.SelectHTMLAttributes<HTMLSelectElement>),
      filteredSections.map(section => 
        React.createElement('option', { key: section.id, value: section.id }, section.title)
      )
    ),
    selectedSection ? 
      React.createElement('div', {className: "flex-1 overflow-y-auto custom-scrollbar bg-slate-700 p-2 rounded"},
         React.createElement('h4', { className: "text-md font-semibold text-sky-300 mb-1"}, selectedSection.title),
         React.createElement('p', { className: "text-sm text-slate-200 whitespace-pre-wrap break-words" }, selectedSection.content)
      ) : 
      searchText && filteredSections.length === 0 ? 
        React.createElement('p', { className: "text-sm text-slate-400 flex-1" }, `「${searchText}」に一致するルールは見つかりませんでした。`)
      : filteredSections.length > 0 ?
        React.createElement('p', { className: "text-sm text-slate-400 flex-1" }, "セクションを選択して内容を表示します。")
      :
        React.createElement('p', { className: "text-sm text-slate-400 flex-1" }, "表示できるルールセクションがありません。")
  );
};
// --- End of components/RulebookPanel.js content ---

// --- Start of components/PlayLog.js content ---
const { jsPDF: JsPDFConstructor } = window.jspdf; 
const localHtml2Canvas = window.html2canvas;

const PlayLogEntryItem = ({ 
  entry, 
  isActuallyEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  currentEditText,
  setCurrentEditText,
  currentEditColorKey,
  setCurrentEditColorKey
}) => {
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isActuallyEditing) {
      const timerId = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const currentValLength = inputRef.current.value.length;
          inputRef.current.setSelectionRange(currentValLength, currentValLength);
        }
      }, 0);
      return () => clearTimeout(timerId);
    }
  }, [isActuallyEditing]);

  const handleSave = () => {
    if (currentEditText.trim() === '') {
        alert("内容は空にできません。");
        return;
    }
    onSaveEdit(entry.id, currentEditText, currentEditColorKey);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onCancelEdit();
    }
  };
  
  const baseClasses = "py-1 px-2 rounded break-words whitespace-pre-wrap w-full text-sm sm:text-base";
  const headingClasses = entry.type === 'heading' ? 'text-lg sm:text-xl font-semibold mt-3 mb-1 text-teal-300' : '';
  const colorClass = PREDEFINED_COLORS[entry.colorKey] || PREDEFINED_COLORS.default;

  return React.createElement('div', { className: `group relative ${entry.type === 'heading' ? 'pt-2' : ''}` },
    isActuallyEditing ? (
      React.createElement('div', { className: "bg-tertiary p-2 rounded-md shadow-lg" }, 
        React.createElement('textarea', ({
          ref: inputRef,
          value: currentEditText,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentEditText(e.target.value),
          onKeyDown: handleKeyDown,
          className: "w-full p-2 bg-secondary text-primary border border-primary rounded-md resize-y custom-scrollbar text-sm sm:text-base",
          rows: Math.max(2, currentEditText.split('\n').length),
          'aria-label': "ログエントリー編集"
        } as React.TextareaHTMLAttributes<HTMLTextAreaElement>)),
        entry.type === 'normal' && (
          React.createElement('div', { className: "mt-2 flex gap-1" },
            Object.entries(PREDEFINED_COLORS).map(([key, className]) => (
              React.createElement('button', ({
                key: key,
                title: key,
                onClick: () => setCurrentEditColorKey(key),
                className: `w-6 h-6 rounded border-2 ${currentEditColorKey === key ? 'border-white ring-2 ring-sky-400' : 'border-transparent'} ${className.replace('text-', 'bg-')}`,
                'aria-label': `Set color to ${key}`
              } as React.ButtonHTMLAttributes<HTMLButtonElement>))
            ))
          )
        ),
        React.createElement('div', { className: "mt-2 flex gap-2 items-center" },
          React.createElement('button', ({ onClick: handleSave, className: "px-3 py-1 accent-green-bg text-white hover:bg-green-500 rounded text-xs flex items-center gap-1" } as React.ButtonHTMLAttributes<HTMLButtonElement>),
            React.createElement(SaveIcon, { className: "w-3 h-3" }), " 保存"
          ),
          React.createElement('button', ({ onClick: onCancelEdit, className: "px-3 py-1 bg-tertiary hover:bg-tertiary-hover text-primary rounded text-xs" } as React.ButtonHTMLAttributes<HTMLButtonElement>),
            "キャンセル"
          ),
          React.createElement('button', ({
              onClick: () => onDelete(entry.id),
              className: "px-3 py-1 accent-red-bg text-white hover:bg-red-500 rounded text-xs flex items-center gap-1 ml-auto",
              title: "投稿を削除"
          } as React.ButtonHTMLAttributes<HTMLButtonElement>),
            React.createElement(TrashIcon, { className: "w-3 h-3" }), " 削除"
          )
        )
      )
    ) : (
      React.createElement('div', { className: `${baseClasses} ${headingClasses} ${colorClass}` },
        entry.content
      )
    ),
    !isActuallyEditing && (
      React.createElement('div', { className: "absolute top-0 right-0 flex opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-secondary/80 rounded-bl-md" },
        React.createElement('button', ({
          onClick: () => onStartEdit(entry),
          className: "p-1 accent-sky-text hover:text-sky-300",
          title: "編集",
          'aria-label': "このエントリーを編集"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>),
          React.createElement(EditIcon, { className: "w-4 h-4" })
        ),
        React.createElement('button', ({
          onClick: () => onDelete(entry.id),
          className: "p-1 accent-red-text hover:text-red-300",
          title: "削除",
          'aria-label': "このエントリーを削除"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>),
          React.createElement(TrashIcon, { className: "w-4 h-4" })
        )
      )
    )
  );
};

const EditableTitle = ({ title, onTitleChange }) => {
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [editTitleText, setEditTitleText] = React.useState(title);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setEditTitleText(title);
  }, [title]);

  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = () => {
    if (editTitleText.trim() === '') {
      onTitleChange("プレイログ"); 
    } else {
      onTitleChange(editTitleText.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditTitleText(title);
      setIsEditingTitle(false);
    }
  };

  if (isEditingTitle) {
    return React.createElement('input', ({
      ref: titleInputRef,
      type: 'text',
      value: editTitleText,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditTitleText(e.target.value),
      onBlur: handleSaveTitle,
      onKeyDown: handleTitleKeyDown,
      className: "text-xl sm:text-2xl font-semibold accent-teal-text bg-transparent border-b-2 border-teal-500 focus:outline-none w-full sm:w-auto",
      maxLength: 50,
      'aria-label': "プレイログタイトル編集"
    } as React.InputHTMLAttributes<HTMLInputElement>));
  }

  return React.createElement('h2', ({
    className: "text-xl sm:text-2xl font-semibold accent-teal-text cursor-pointer hover:border-b-2 hover:border-teal-500/50 py-1",
    onClick: () => setIsEditingTitle(true),
    title: "クリックしてタイトルを編集"
  } as React.HTMLAttributes<HTMLHeadingElement>), title || "プレイログ");
};

const generateExportHTMLContent = (playLogTitle, characterSheet, playLogEntries, theme) => {
  const themeColors = THEME_SPECIFIC_PLAYLOG_COLORS[theme] || THEME_SPECIFIC_PLAYLOG_COLORS.dark;
  const pageStyles = THEME_EXPORT_PAGE_STYLES[theme] || THEME_EXPORT_PAGE_STYLES.dark;

  const escapeHtml = (unsafe) => {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe) 
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  };

  let html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(playLogTitle)} - Solo RPG Export</title>
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0; 
          padding: 0; 
          background-color: ${pageStyles.bodyBackground}; 
          color: ${pageStyles.bodyColor};
          line-height: 1.6;
        }
        .container { 
          max-width: 800px; 
          margin: 0 auto; 
          padding: 20px; 
          box-sizing: border-box; 
        }
        h1, h2, h3 { color: ${pageStyles.headingColor}; }
        h1 { border-bottom: 2px solid ${pageStyles.hrColor}; padding-bottom: 10px; }
        h2 { margin-top: 30px; border-bottom: 1px solid ${pageStyles.hrColor}; padding-bottom: 5px;}
        h3.custom-field-name, h3.stats-details-heading { margin-top: 20px; margin-bottom: 5px; font-size: 1.1em; }
        h3.log-type-heading { font-size: 1.25em; font-weight: bold; margin-top: 1.5em; margin-bottom: 0.5em; }
        pre { 
          background-color: ${pageStyles.preBackground}; 
          color: ${pageStyles.preColor};
          padding: 15px; 
          border-radius: 5px; 
          white-space: pre-wrap; 
          word-wrap: break-word; 
          font-size: 0.9em;
          margin-top: 0;
        }
        img.character-image { max-width: 200px; max-height: 250px; border-radius: 5px; margin-bottom: 15px; border: 1px solid ${pageStyles.hrColor}; }
        .play-log-entry { margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>キャラクターシート</h1>
        <h2>${escapeHtml(characterSheet.name) || '名称未設定'}</h2>`;

  if (characterSheet.image) {
    html += `<img src="${escapeHtml(characterSheet.image)}" alt="${escapeHtml(characterSheet.name)}" class="character-image" />`;
  }
  
  if (typeof characterSheet.stats === 'string' && characterSheet.stats.trim() !== '') {
     html += `<h3 class="stats-details-heading">${escapeHtml(characterSheet.statsLabel || "能力値・詳細")}</h3><pre>${escapeHtml(characterSheet.stats)}</pre>`;
  } else if (typeof characterSheet.stats === 'string') {
     html += `<h3 class="stats-details-heading">${escapeHtml(characterSheet.statsLabel || "能力値・詳細")}</h3><pre>記載なし</pre>`;
  }

  if (characterSheet.customFields && characterSheet.customFields.length > 0) {
    html += `<h2>カスタム項目</h2>`;
    characterSheet.customFields.forEach(field => {
      html += `<h3 class="custom-field-name">${escapeHtml(field.fieldName)}</h3><pre>${escapeHtml(field.fieldValue) || '記載なし'}</pre>`;
    });
  }

  html += `<h1>${escapeHtml(playLogTitle) || 'プレイログ'}</h1>`;

  playLogEntries.forEach(entry => {
    const entryColor = themeColors[entry.colorKey] || themeColors.default;
    
    if (entry.type === 'heading') {
      html += `<h3 class="play-log-entry log-type-heading" style="color: ${entryColor};">${escapeHtml(entry.content)}</h3>`;
    } else {
      html += `
        <div class="play-log-entry" style="color: ${entryColor};">
          <span>${escapeHtml(entry.content).replace(/\n/g, '<br>')}</span>
        </div>`;
    }
  });

  html += `
      </div>
    </body>
    </html>`;
  return html; 
};

const PlayLog = ({ 
  playLogEntries, 
  playLogTitle, 
  onPlayLogTitleChange, 
  onAddEntry, 
  onUpdateEntry, 
  onDeleteEntry, 
  onUndo, 
  onRedo, 
  canUndo,
  canRedo,
  characterSheet, 
  currentTheme 
}) => {
  const [currentInput, setCurrentInput] = React.useState('');
  const [currentInputType, setCurrentInputType] = React.useState('normal');
  const [currentInputColorKey, setCurrentInputColorKey] = React.useState('default');
  const [showColorPicker, setShowColorPicker] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const logEndRef = React.useRef<HTMLDivElement>(null);

  const [editingEntryDetails, setEditingEntryDetails] = React.useState(null); 

  const handleStartEdit = (entry) => {
    setEditingEntryDetails({
      id: entry.id,
      currentText: entry.content,
      currentColorKey: entry.colorKey,
    });
  };

  const handleSaveEdit = (id, content, colorKey) => {
    onUpdateEntry(id, content, colorKey);
    setEditingEntryDetails(null);
  };

  const handleCancelEdit = () => {
    setEditingEntryDetails(null);
  };

  const submitCurrentInput = () => {
    if (currentInput.trim() === '') return;
    if (typeof onAddEntry === 'function') {
        onAddEntry(currentInput, currentInputType, currentInputColorKey);
    } else {
        console.error("PlayLog: onAddEntry is not a function!");
        alert("エラー: ログエントリーを追加できませんでした。");
    }
    setCurrentInput('');
    setCurrentInputType('normal');
    setCurrentInputColorKey('default');
    setShowColorPicker(false);
  };
  
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitCurrentInput();
  };

  React.useEffect(() => {
    if (playLogEntries && playLogEntries.length > 0) {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [playLogEntries]);
  
  const handleExportHTML = () => {
    setIsExporting(true);
    try {
      const htmlContent = generateExportHTMLContent(playLogTitle, characterSheet, playLogEntries, currentTheme);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `playlog-${characterSheet?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'session'}-${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error("Error exporting HTML:", error);
        alert("HTMLエクスポート中にエラーが発生しました。");
    } finally {
        setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    const reportHtml = generateExportHTMLContent(playLogTitle, characterSheet, playLogEntries, currentTheme);
    
    const hiddenDiv = document.createElement('div');
    hiddenDiv.innerHTML = reportHtml;
    hiddenDiv.style.position = 'absolute';
    hiddenDiv.style.left = '0px'; 
    hiddenDiv.style.top = `-${Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 10000)}px`; 
    hiddenDiv.style.width = '800px'; 
    hiddenDiv.style.visibility = 'hidden'; 
    
    document.body.appendChild(hiddenDiv);
    const captureTarget = hiddenDiv.querySelector('.container') as HTMLElement; 

    if (!captureTarget) {
        document.body.removeChild(hiddenDiv);
        setIsExporting(false);
        console.error("PDF export: Could not find .container element within the generated HTML.");
        alert("PDFエクスポートエラー: 内部コンテンツが見つかりません。");
        return;
    }
    
    try {
        await new Promise(resolve => setTimeout(resolve, 700)); 

        const canvas = await localHtml2Canvas(captureTarget, { 
            scale: 2, 
            useCORS: true,
            logging: true, 
            backgroundColor: THEME_EXPORT_PAGE_STYLES[currentTheme]?.bodyBackground || '#ffffff',
            width: captureTarget.scrollWidth,
            height: captureTarget.scrollHeight,
            x: 0, 
            y: 0,
            windowWidth: captureTarget.scrollWidth,
            windowHeight: captureTarget.scrollHeight,
        });
        
        if (canvas.width === 0 || canvas.height === 0) {
            throw new Error("PDF export: html2canvas created an empty canvas (0x0).");
        }
        
        const imgData = canvas.toDataURL('image/png');
        
        const pdf = new JsPDFConstructor({ 
            orientation: 'p',
            unit: 'px', 
            format: [canvas.width, canvas.height],
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height, undefined, 'FAST');
        pdf.save(`playlog-${characterSheet?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'session'}-${new Date().toISOString().slice(0,10)}.pdf`);

    } catch (error) {
        console.error("Error during PDF export process:", error);
        alert(`PDFエクスポート中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}。 詳細はコンソールを確認してください。`);
    } finally {
        if (document.body.contains(hiddenDiv)) {
          document.body.removeChild(hiddenDiv);
        }
        setIsExporting(false);
    }
  };

  return React.createElement('div', { className: "flex flex-col flex-1 bg-secondary p-3 sm:p-4 rounded-lg shadow-xl min-h-0" },
    React.createElement('div', { className: "flex flex-wrap justify-between items-center mb-2 gap-2" },
      React.createElement(EditableTitle, { title: playLogTitle, onTitleChange: onPlayLogTitleChange }),
      React.createElement('div', { className: "flex gap-2 items-center" },
        React.createElement('button', ({
          onClick: onUndo,
          disabled: !canUndo || isExporting,
          className: "p-2 accent-sky-bg hover:accent-sky-bg-hover text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
          'aria-label': "元に戻す",
          title: "元に戻す"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(UndoIcon, { className: "w-4 h-4" })
        ),
        React.createElement('button', ({
          onClick: onRedo,
          disabled: !canRedo || isExporting,
          className: "p-2 accent-sky-bg hover:accent-sky-bg-hover text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
          'aria-label': "やり直す",
          title: "やり直す"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(RedoIcon, { className: "w-4 h-4" })
        ),
        React.createElement('button', ({
            onClick: handleExportHTML,
            disabled: isExporting,
            className: "p-2 accent-blue-bg hover:bg-blue-500 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1 text-sm",
            title: "HTMLとしてエクスポート"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>), React.createElement(DocumentArrowDownIcon, { className: "w-4 h-4" }), " HTML")
      )
    ),
    React.createElement('div', { className: "flex-1 w-full bg-tertiary border border-primary rounded-md p-2 overflow-y-auto custom-scrollbar mb-3 space-y-1 min-h-96" },
      playLogEntries.length === 0 && (
        React.createElement('p', { className: "text-muted text-center py-4" }, "ログはありません。")
      ),
      playLogEntries.map(entry => (
        React.createElement(PlayLogEntryItem, {
          key: entry.id,
          entry: entry,
          isActuallyEditing: editingEntryDetails?.id === entry.id,
          onStartEdit: handleStartEdit,
          onSaveEdit: handleSaveEdit,
          onCancelEdit: handleCancelEdit,
          onDelete: onDeleteEntry,
          currentEditText: editingEntryDetails?.id === entry.id ? editingEntryDetails.currentText : '',
          setCurrentEditText: (text) => editingEntryDetails?.id === entry.id && setEditingEntryDetails(prev => prev ? {...prev, currentText: text} : null),
          currentEditColorKey: editingEntryDetails?.id === entry.id ? editingEntryDetails.currentColorKey : 'default',
          setCurrentEditColorKey: (colorKey) => editingEntryDetails?.id === entry.id && setEditingEntryDetails(prev => prev ? {...prev, currentColorKey: colorKey} : null),
        })
      )),
      React.createElement('div', { ref: logEndRef })
    ),
    React.createElement('form', { onSubmit: handleFormSubmit, className: "mt-auto" },
      React.createElement('label', { htmlFor: "playLogInput", className: "block text-lg sm:text-xl font-semibold accent-teal-text mb-1" }, "入力欄"),
      React.createElement('textarea', ({
        id: "playLogInput",
        value: currentInput,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setCurrentInput(e.target.value),
        placeholder: "新しいログエントリーを入力 (Shift+Enterで投稿、Enterで改行)...",
        className: "w-full p-2 sm:p-3 bg-tertiary text-primary border border-primary rounded-md resize-y focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm sm:text-base custom-scrollbar",
        rows: 2,
        onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            submitCurrentInput();
          }
        }
      } as React.TextareaHTMLAttributes<HTMLTextAreaElement>)),
      React.createElement('div', { className: "flex flex-wrap gap-2 mt-2 items-center" },
        React.createElement('button', ({
          type: "button",
          onClick: () => setCurrentInputType(prev => prev === 'heading' ? 'normal' : 'heading'),
          className: `px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1 ${currentInputType === 'heading' ? 'accent-teal-bg text-white' : 'bg-tertiary hover:bg-tertiary-hover text-primary'}`,
          title: "見出しとして追加"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>), 
          React.createElement(HeadingIcon, { className: "w-4 h-4" }), " 見出し ", currentInputType === 'heading' && React.createElement(CheckIcon, { className: "w-3 h-3" })
        ),
        React.createElement('div', { className: "relative" },
          React.createElement('button', ({
              type: "button",
              onClick: () => setShowColorPicker(!showColorPicker),
              disabled: currentInputType === 'heading',
              className: "px-3 py-1.5 text-sm rounded-md bg-tertiary hover:bg-tertiary-hover text-primary disabled:opacity-50 flex items-center gap-1",
              title: "文字色を選択",
              'aria-haspopup': "true",
              'aria-expanded': showColorPicker
          } as React.ButtonHTMLAttributes<HTMLButtonElement>),
            React.createElement(PaletteIcon, { className: `w-4 h-4 ${PREDEFINED_COLORS[currentInputColorKey] || PREDEFINED_COLORS.default}` }), " 色"
          ),
          showColorPicker && currentInputType === 'normal' && (
            React.createElement('div', { className: "absolute bottom-full left-0 mb-2 bg-tertiary p-2 rounded shadow-lg flex gap-1 border border-primary z-10", role: "dialog", "aria-label": "文字色選択パレット" },
              Object.entries(PREDEFINED_COLORS).map(([key, className]) => (
                React.createElement('button', ({
                  type: "button",
                  key: key,
                  title: key,
                  'aria-label': `文字色を${key}に設定`,
                  onClick: () => { setCurrentInputColorKey(key); setShowColorPicker(false); },
                  className: `w-6 h-6 rounded border-2 ${currentInputColorKey === key ? 'border-white ring-2 ring-sky-400' : 'border-transparent'} ${className.replace('text-', 'bg-')}`
                } as React.ButtonHTMLAttributes<HTMLButtonElement>))
              ))
            )
          )
        ),
        React.createElement('button', ({
          type: "submit",
          className: "px-4 py-2 accent-teal-bg hover:accent-teal-bg-hover text-white font-semibold rounded-md transition-colors shadow-md ml-auto"
        } as React.ButtonHTMLAttributes<HTMLButtonElement>), "追加")
      )
    )
  );
};
// --- End of components/PlayLog.js content ---

// --- Start of App.js content ---
const { useState: uState, useCallback: uCallback, useEffect: uEffect, useRef: uRef } = React;

const LOCAL_STORAGE_KEY = 'soloRPGCompanionSession';
const initialPlayLogTitle = "プレイログ";

const initialCharacterSheetValues = {
  name: 'キャラクター名',
  image: null,
  stats: '', 
  statsLabel: "能力値・詳細",
  customFields: [] 
};
const initialDefaultTheme = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const MAX_HISTORY_SIZE = 10; 

const getInitialSessionData = () => {
  const newSessionId = crypto.randomUUID();
  const initialSheet = JSON.parse(JSON.stringify(initialCharacterSheetValues));
  console.log(`getInitialSessionData: New session ID: ${newSessionId}, Initial statsLabel: "${initialSheet.statsLabel}", Initial customFields count: ${initialSheet.customFields.length}`);
  return {
    sessionId: newSessionId, 
    playLogEntries: [],
    playLogTitle: initialPlayLogTitle,
    characterSheet: initialSheet,
    tables: [],
    resourceTrackers: [],
    diceRollHistory: [],
    theme: initialDefaultTheme,
    loadedGameDataPackage: null,
    gameDataPackageLoadId: null,
  };
};

const validateAndMigrateData = (loadedData) => {
    if (!loadedData || typeof loadedData !== 'object') {
        return getInitialSessionData();
    }
    
    const validated = { ...getInitialSessionData(), sessionId: crypto.randomUUID() }; 

    if (Array.isArray(loadedData.playLogEntries)) {
        validated.playLogEntries = loadedData.playLogEntries.map(entry => {
            if (typeof entry === 'object' && entry !== null) {
                return {
                    id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
                    content: typeof entry.content === 'string' ? entry.content : '',
                    type: typeof entry.type === 'string' && ['normal', 'heading'].includes(entry.type) ? entry.type : 'normal',
                    colorKey: typeof entry.colorKey === 'string' && Object.keys(PREDEFINED_COLORS).includes(entry.colorKey) ? entry.colorKey : 'default',
                    timestamp: typeof entry.timestamp === 'string' && !isNaN(new Date(entry.timestamp).getTime()) ? entry.timestamp : new Date().toISOString(),
                };
            }
            return null;
        }).filter(e => e !== null);
    }
    
    validated.playLogTitle = typeof loadedData.playLogTitle === 'string' ? loadedData.playLogTitle : initialPlayLogTitle;

    const loadedSheet = loadedData.characterSheet || {};
    validated.characterSheet = {
        name: typeof loadedSheet.name === 'string' ? loadedSheet.name : initialCharacterSheetValues.name,
        image: typeof loadedSheet.image === 'string' || loadedSheet.image === null ? loadedSheet.image : initialCharacterSheetValues.image,
        stats: typeof loadedSheet.stats === 'string' ? loadedSheet.stats : initialCharacterSheetValues.stats,
        statsLabel: typeof loadedSheet.statsLabel === 'string' ? loadedSheet.statsLabel : initialCharacterSheetValues.statsLabel,
        customFields: Array.isArray(loadedSheet.customFields)
        ? loadedSheet.customFields.map(cf => ({
            id: typeof cf?.id === 'string' ? cf.id : crypto.randomUUID(),
            fieldName: typeof cf?.fieldName === 'string' ? cf.fieldName : '', 
            fieldValue: typeof cf?.fieldValue === 'string' ? cf.fieldValue : '',
        })).filter(cf => cf !== null)
        : initialCharacterSheetValues.customFields,
    };
    
    if (Array.isArray(loadedData.tables)) {
        validated.tables = loadedData.tables.map(table => {
            if (typeof table !== 'object' || table === null) return null;
            return {
                id: typeof table.id === 'string' ? table.id : crypto.randomUUID(),
                name: typeof table.name === 'string' ? table.name : '無名テーブル',
                diceCommand: typeof table.diceCommand === 'string' ? table.diceCommand : '',
                entries: Array.isArray(table.entries) ? table.entries.map(entry => {
                    if (typeof entry !== 'object' || entry === null) return null;
                    return {
                        id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
                        value: typeof entry.value === 'string' ? entry.value : '',
                        rollValue: typeof entry.rollValue === 'string' ? entry.rollValue : undefined,
                    };
                }).filter(e => e !== null) : [],
            };
        }).filter(t => t !== null);
    }

    if (Array.isArray(loadedData.resourceTrackers)) {
        validated.resourceTrackers = loadedData.resourceTrackers.map(tracker => {
            if (typeof tracker !== 'object' || tracker === null) return null;
            return {
                id: typeof tracker.id === 'string' ? tracker.id : crypto.randomUUID(),
                name: typeof tracker.name === 'string' ? tracker.name : '無名リソース',
                value: typeof tracker.value === 'number' ? tracker.value : 0,
                history: Array.isArray(tracker.history) ? tracker.history.map(h => {
                    if (typeof h !== 'object' || h === null) return null;
                    return {
                        id: typeof h.id === 'string' ? h.id : crypto.randomUUID(),
                        timestamp: typeof h.timestamp === 'string' && !isNaN(new Date(h.timestamp).getTime()) ? h.timestamp : new Date().toISOString(),
                        change: typeof h.change === 'number' ? h.change : 0,
                        previousValue: typeof h.previousValue === 'number' ? h.previousValue : 0,
                        newValue: typeof h.newValue === 'number' ? h.newValue : 0,
                        reason: typeof h.reason === 'string' ? h.reason : '',
                    };
                }).filter(h => h !== null) : [],
            };
        }).filter(rt => rt !== null);
    }

    if (Array.isArray(loadedData.diceRollHistory)) {
        validated.diceRollHistory = loadedData.diceRollHistory.map(roll => {
            if (typeof roll !== 'object' || roll === null) return null;
            return {
                id: typeof roll.id === 'string' ? roll.id : crypto.randomUUID(),
                command: typeof roll.command === 'string' ? roll.command : '',
                individualRolls: Array.isArray(roll.individualRolls) ? roll.individualRolls.filter(n => typeof n === 'number') : [],
                total: typeof roll.total === 'number' ? roll.total : 0,
                timestamp: typeof roll.timestamp === 'string' && !isNaN(new Date(roll.timestamp).getTime()) ? roll.timestamp : new Date().toISOString(),
            };
        }).filter(r => r !== null);
    }
    
    validated.theme = typeof loadedData.theme === 'string' ? loadedData.theme : initialDefaultTheme;
    
    if (loadedData.loadedGameDataPackage && typeof loadedData.loadedGameDataPackage === 'object') {
        const pkg = loadedData.loadedGameDataPackage;
         validated.loadedGameDataPackage = { 
             ...DEFAULT_GAME_DATA_PACKAGE_STRUCTURE, 
             ...pkg,
             manifest: {...DEFAULT_GAME_DATA_PACKAGE_STRUCTURE.manifest, ...(pkg.manifest || {})},
             characterSheetTemplate: {
                ...DEFAULT_GAME_DATA_PACKAGE_STRUCTURE.characterSheetTemplate, 
                ...(pkg.characterSheetTemplate || {}),
                baseStats: Array.isArray(pkg.characterSheetTemplate?.baseStats) ? pkg.characterSheetTemplate.baseStats : [],
                customFieldTemplates: Array.isArray(pkg.characterSheetTemplate?.customFieldTemplates) ? 
                    pkg.characterSheetTemplate.customFieldTemplates.map(cft => ({
                        id: cft.id || crypto.randomUUID(),
                        label: cft.label || "無題の項目",
                        type: ['text', 'textarea', 'number'].includes(cft.type) ? cft.type : 'text'
                    })) 
                    : []
             },
             rulebookSections: Array.isArray(pkg.rulebookSections) ? pkg.rulebookSections.map(section => ({
                 id: typeof section.id === 'string' ? section.id : crypto.randomUUID(),
                 title: typeof section.title === 'string' ? section.title : '無題のセクション',
                 content: typeof section.content === 'string' ? section.content : '',
             })) : [],
             randomTables: Array.isArray(pkg.randomTables) ? pkg.randomTables.map(rt => ({
                 id: rt.id || crypto.randomUUID(),
                 name: rt.name || "無題のテーブル",
                 diceCommand: rt.diceCommand || "",
                 entries: Array.isArray(rt.entries) ? rt.entries.map(e => ({
                     id: e.id || crypto.randomUUID(),
                     rollValue: e.rollValue || "",
                     value: e.value || ""
                 })) : []
             })) : [],
             resourceTrackerTemplates: Array.isArray(pkg.resourceTrackerTemplates) ? pkg.resourceTrackerTemplates.map(rtt => ({
                 id: rtt.id || crypto.randomUUID(),
                 name: rtt.name || "無題のリソース",
                 initialValue: typeof rtt.initialValue === 'number' ? rtt.initialValue : 0
             })) : []
         };
    }
    
    validated.gameDataPackageLoadId = typeof loadedData.gameDataPackageLoadId === 'string' ? loadedData.gameDataPackageLoadId : null;
    if (validated.loadedGameDataPackage && !validated.gameDataPackageLoadId) {
        validated.gameDataPackageLoadId = crypto.randomUUID();
    }
    if (!validated.loadedGameDataPackage) { 
        validated.gameDataPackageLoadId = null;
    }
    validated.sessionId = typeof loadedData.sessionId === 'string' ? loadedData.sessionId : crypto.randomUUID();


    return validated;
};


const App = () => {
  console.log("App component: Initializing."); 
  const [sessionHistory, setSessionHistory] = uState(() => {
    console.log("App component: Initializing session history from localStorage or defaults."); 
    try {
      const savedSession = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedSession) {
        const parsedData = JSON.parse(savedSession);
        return [validateAndMigrateData(parsedData)];
      }
    } catch (e) {
      console.error("Error loading session from localStorage:", e);
    }
    return [getInitialSessionData()];
  });
  const [currentSessionIndex, setCurrentSessionIndex] = uState(0);

  const currentSessionData = sessionHistory[currentSessionIndex];
  console.log("App component: Current session data ID:", currentSessionData?.sessionId); 


  uEffect(() => {
    if (currentSessionData?.theme) {
      document.documentElement.className = '';
      if (currentSessionData.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.add(`theme-${currentSessionData.theme}`);
      }
    }
  }, [currentSessionData?.theme]);

  uEffect(() => {
    if (currentSessionData && currentSessionData.sessionId) { 
      console.log("App component: Saving current session to localStorage. Session ID:", currentSessionData.sessionId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentSessionData));
    } else {
      console.warn("App component: Attempted to save session, but currentSessionData or sessionId is missing.");
    }
  }, [currentSessionData]);
  
  const updateHistory = uCallback((sessionUpdaterFuncOrState) => {
    console.log("App component: updateHistory called."); 
    setSessionHistory(prevHistory => {
        const currentActualSessionFromPrev = prevHistory[currentSessionIndex];
        
        let newSessionState;
        if (typeof sessionUpdaterFuncOrState === 'function') {
             console.log("App component: updateHistory - sessionUpdater is a function.");
            if (sessionUpdaterFuncOrState.length === 0) { 
                newSessionState = sessionUpdaterFuncOrState();
            } else {
                newSessionState = sessionUpdaterFuncOrState(currentActualSessionFromPrev);
            }
        } else {
             console.log("App component: updateHistory - sessionUpdater is a state object.");
            newSessionState = sessionUpdaterFuncOrState;
        }

        if (!newSessionState || !newSessionState.sessionId) { 
            console.warn("[App.js updateHistory] newSessionState is invalid or missing sessionId. Aborting update.", newSessionState);
            return prevHistory; 
        }
        console.log("App component: updateHistory - newSessionState.sessionId:", newSessionState.sessionId); 

        const historyUpToCurrent = prevHistory.slice(0, currentSessionIndex + 1);
        let updatedFullHistory = [...historyUpToCurrent, newSessionState];

        if (updatedFullHistory.length > MAX_HISTORY_SIZE) {
            updatedFullHistory = updatedFullHistory.slice(updatedFullHistory.length - MAX_HISTORY_SIZE);
        }
        
        const newCurrentIndex = updatedFullHistory.length - 1;
        setCurrentSessionIndex(newCurrentIndex);
        console.log("App component: updateHistory - updated. New history length:", updatedFullHistory.length, "New index:", newCurrentIndex);
        return updatedFullHistory;
    });
  }, [currentSessionIndex]); // Removed sessionHistory from dependencies as it's available via prevHistory in setter


  const addPlayLogEntry = uCallback((content, type = 'normal', colorKey = 'default', updatesForSession = null) => {
    updateHistory(currentData => {
      const basePlayLog = Array.isArray(currentData?.playLogEntries) ? currentData.playLogEntries : [];
      const newEntry = {
        id: crypto.randomUUID(),
        content,
        type,
        colorKey,
        timestamp: new Date().toISOString(),
      };
      let newSessionData = {
        ...currentData,
        sessionId: currentData.sessionId, 
        playLogEntries: [...basePlayLog, newEntry]
      };

      if (updatesForSession && typeof updatesForSession === 'object') {
        if (updatesForSession.resourceTrackers !== undefined) {
          const baseResourceTrackers = Array.isArray(currentData?.resourceTrackers) ? currentData.resourceTrackers : [];
          newSessionData.resourceTrackers = Array.isArray(updatesForSession.resourceTrackers) ? updatesForSession.resourceTrackers : baseResourceTrackers;
        }
      }
      return newSessionData;
    });
  }, [updateHistory]);

  const deletePlayLogEntry = uCallback((id) => {
    updateHistory(currentData => {
      const basePlayLog = Array.isArray(currentData?.playLogEntries) ? currentData.playLogEntries : [];
      return {
        ...currentData,
        sessionId: currentData.sessionId,
        playLogEntries: basePlayLog.filter(entry => entry.id !== id),
      };
    });
  }, [updateHistory]);

  const updatePlayLogEntry = uCallback((id, newContent, newColorKey = 'default') => {
    updateHistory(currentData => {
      const basePlayLog = Array.isArray(currentData?.playLogEntries) ? currentData.playLogEntries : [];
      return {
        ...currentData,
        sessionId: currentData.sessionId,
        playLogEntries: basePlayLog.map(entry =>
          entry.id === id ? { ...entry, content: newContent, colorKey: newColorKey, timestamp: new Date().toISOString() } : entry
        ),
      };
    });
  }, [updateHistory]);
  
  const setPlayLogTitle = uCallback((newTitle) => {
    updateHistory(currentData => ({ ...currentData, sessionId: currentData.sessionId, playLogTitle: newTitle }));
  }, [updateHistory]);

  const setCharacterSheet = uCallback((newSheetOrUpdater) => {
    updateHistory(currentData => {
        const currentActualSheet = currentData?.characterSheet || initialCharacterSheetValues;
        const newSheet = typeof newSheetOrUpdater === 'function'
            ? newSheetOrUpdater(currentActualSheet)
            : newSheetOrUpdater;
        return { ...currentData, sessionId: currentData.sessionId, characterSheet: newSheet };
    });
  }, [updateHistory]);


  const setTables = uCallback((newTablesOrUpdater) => {
    updateHistory(currentData => {
      const currentActualTables = Array.isArray(currentData?.tables) ? currentData.tables : [];
      const newTables = typeof newTablesOrUpdater === 'function' 
                        ? newTablesOrUpdater(currentActualTables) 
                        : newTablesOrUpdater;
      return { ...currentData, sessionId: currentData.sessionId, tables: newTables };
    });
  }, [updateHistory]);

  const setResourceTrackers = uCallback((newTrackersOrUpdater) => {
    updateHistory(currentData => {
      const currentActualTrackers = Array.isArray(currentData?.resourceTrackers) ? currentData.resourceTrackers : [];
       const newTrackers = typeof newTrackersOrUpdater === 'function' 
                        ? newTrackersOrUpdater(currentActualTrackers) 
                        : newTrackersOrUpdater;
      return { ...currentData, sessionId: currentData.sessionId, resourceTrackers: newTrackers };
    });
  }, [updateHistory]);

  const setDiceRollHistory = uCallback((newHistoryOrUpdater) => {
    updateHistory(currentData => {
      const currentActualHistory = Array.isArray(currentData?.diceRollHistory) ? currentData.diceRollHistory : [];
      const newHistory = typeof newHistoryOrUpdater === 'function' 
                        ? newHistoryOrUpdater(currentActualHistory) 
                        : newHistoryOrUpdater;
      return { ...currentData, sessionId: currentData.sessionId, diceRollHistory: newHistory };
    });
  }, [updateHistory]);

  const setTheme = uCallback((newTheme) => {
    updateHistory(currentData => ({ ...currentData, sessionId: currentData.sessionId, theme: newTheme }));
  }, [updateHistory]);
  
  const setLoadedGameDataPackage = uCallback((gameDataPkg, newLoadIdOverride = null) => {
    updateHistory(currentData => {
        let updatedSheet = { ...currentData.characterSheet };
        let updatedTrackers = [...currentData.resourceTrackers];
        let updatedTables = [...currentData.tables];
        let effectiveLoadId = newLoadIdOverride;

        if (gameDataPkg) {
            if (gameDataPkg.characterSheetTemplate) {
                const csTemplate = gameDataPkg.characterSheetTemplate;
                updatedSheet.statsLabel = csTemplate.statsLabel || initialCharacterSheetValues.statsLabel;
                if (updatedSheet.customFields.length === 0 && csTemplate.customFieldTemplates) {
                   updatedSheet.customFields = csTemplate.customFieldTemplates.map(tmpl => ({
                        id: crypto.randomUUID(),
                        fieldName: tmpl.label, 
                        fieldValue: tmpl.type === 'number' ? '0' : '' 
                   }));
                }
            }
            if (updatedTrackers.length === 0 && gameDataPkg.resourceTrackerTemplates && gameDataPkg.resourceTrackerTemplates.length > 0) {
                updatedTrackers = gameDataPkg.resourceTrackerTemplates.map(tmpl => ({
                    id: crypto.randomUUID(),
                    name: tmpl.name,
                    value: tmpl.initialValue,
                    history: []
                }));
            }
             if (updatedTables.length === 0 && gameDataPkg.randomTables && gameDataPkg.randomTables.length > 0) {
                updatedTables = JSON.parse(JSON.stringify(gameDataPkg.randomTables)); 
            }
            if (!effectiveLoadId) { 
                effectiveLoadId = currentData.gameDataPackageLoadId || crypto.randomUUID();
            }
        } else { 
            effectiveLoadId = null;
            updatedSheet.statsLabel = initialCharacterSheetValues.statsLabel;
            updatedSheet.customFields = JSON.parse(JSON.stringify(initialCharacterSheetValues.customFields));
            updatedTables = [];
            updatedTrackers = [];
        }
        
        return { 
            ...currentData, 
            sessionId: currentData.sessionId,
            loadedGameDataPackage: gameDataPkg,
            gameDataPackageLoadId: effectiveLoadId,
            characterSheet: updatedSheet,
            resourceTrackers: updatedTrackers,
            tables: updatedTables
        };
    });
}, [updateHistory]);

  const handleUndo = () => {
    setCurrentSessionIndex(prevIndex => Math.max(0, prevIndex - 1));
  };

  const handleRedo = () => {
    setCurrentSessionIndex(prevIndex => Math.min(sessionHistory.length - 1, prevIndex + 1));
  };

  const handleSave = () => {
    if (!currentSessionData) {
      alert("保存するデータがありません。");
      return;
    }
    try {
      const dataStr = JSON.stringify(currentSessionData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const characterNamePart = currentSessionData.characterSheet?.name ? currentSessionData.characterSheet.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'session';
      link.download = `solo_rpg_session_${characterNamePart}_${new Date().toISOString().slice(0, 10)}.json`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error saving session:", error);
      alert(`セッションの保存中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleLoadSession = (file: File) => { 
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') throw new Error("ファイルの読み取りに失敗しました。");
        const loadedData = JSON.parse(result);
        const validatedData = validateAndMigrateData(loadedData);
        
        setSessionHistory([validatedData]); 
        setCurrentSessionIndex(0);      
        alert("セッションが正常に読み込まれました。");
      } catch (error) {
        console.error("Error loading session:", error);
        alert(`セッションの読み込み中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    reader.readAsText(file);
  };
  
  const handleLoadGameDataPackageFile = (file: File) => { 
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result !== 'string') throw new Error("ゲームデータファイルの読み取りに失敗しました。");
        let loadedGameData = JSON.parse(result);

        loadedGameData = validateAndMigrateData({ loadedGameDataPackage: loadedGameData }).loadedGameDataPackage; 
        
        if (!loadedGameData || !loadedGameData.manifest.gameTitle) {
            throw new Error("無効なゲームデータパッケージ形式です。");
        }
        const newLoadId = crypto.randomUUID(); 
        setLoadedGameDataPackage(loadedGameData, newLoadId); 
        alert(`ゲームデータ「${loadedGameData.manifest.gameTitle}」を読込。`);
        console.log("Loaded Game Data Package:", loadedGameData, "with Load ID:", newLoadId);

      } catch (error) {
        console.error("Error loading game data package:", error);
        alert(`ゲームデータパッケージの読み込み中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`);
        setLoadedGameDataPackage(null, null); 
      }
    };
    reader.readAsText(file);
  };


  if (!currentSessionData || !currentSessionData.sessionId) { 
    console.log("App component: No currentSessionData or sessionId, rendering loading spinner."); 
    return React.createElement('div', { className: `theme-${initialDefaultTheme} bg-primary text-primary min-h-screen flex items-center justify-center`}, 
      React.createElement(LoadingSpinner, {size: 'lg'})
    );
  }
  
 const handleResetApp = () => {
    console.log("App component: handleResetApp - STEP 1 - Called. Current sessionId:", currentSessionData.sessionId);
    
    const newInitialSessionState = getInitialSessionData();
    console.log("App component: handleResetApp - STEP 2 - New initial state generated. New sessionId:", newInitialSessionState.sessionId);

    setSessionHistory(prevHistory => {
        console.log("App component: handleResetApp - STEP 3 - setSessionHistory called. prevHistory length:", prevHistory.length, "currentSessionIndex:", currentSessionIndex);
        
        let updatedFullHistory = [newInitialSessionState]; 

        console.log("App component: handleResetApp - STEP 4a - History reset to just new initial state. Length:", updatedFullHistory.length);

        if (updatedFullHistory.length > MAX_HISTORY_SIZE) {
            updatedFullHistory = updatedFullHistory.slice(updatedFullHistory.length - MAX_HISTORY_SIZE);
            console.log("App component: handleResetApp - STEP 4b - History trimmed. New length:", updatedFullHistory.length);
        }
        
        const newCurrentIndex = updatedFullHistory.length - 1;
        setCurrentSessionIndex(newCurrentIndex); 
        console.log("App component: handleResetApp - STEP 5 - setCurrentSessionIndex called with:", newCurrentIndex);
        console.log("App component: handleResetApp - STEP 6 - updatedFullHistory[newCurrentIndex].sessionId:", updatedFullHistory[newCurrentIndex]?.sessionId);
        return updatedFullHistory;
    });
     console.log("App component: handleResetApp - STEP 7 - Reset processing likely finished.");
  };

  console.log("App component: Rendering main structure with sessionId key:", currentSessionData.sessionId); 

  return (
    React.createElement('div', { className: `min-h-screen bg-primary text-primary p-2 sm:p-4 flex flex-col gap-2 sm:gap-4 theme-${currentSessionData.theme}` },
      React.createElement(SaveLoadControls, {
        onSave: handleSave,
        onLoad: handleLoadSession,
        onReset: handleResetApp,
        currentTheme: currentSessionData.theme,
        onThemeChange: setTheme,
        onLoadGameDataPackage: handleLoadGameDataPackageFile,
      }),
      React.createElement('div', { 
        key: currentSessionData.sessionId, 
        className: "flex flex-col lg:flex-row gap-2 sm:gap-4 flex-1 min-h-0" 
        }, 
        React.createElement('div', { className: "w-full lg:w-1/3 flex flex-col gap-2 sm:gap-4 overflow-y-auto custom-scrollbar lg:max-h-[calc(100vh-10rem)]" },
          React.createElement(CharacterSheet, {
            data: currentSessionData.characterSheet,
            onDataChange: setCharacterSheet
          }),
          React.createElement(DiceRoller, {
            diceRollHistory: currentSessionData.diceRollHistory,
            setDiceRollHistory: setDiceRollHistory,
            addLogEntry: addPlayLogEntry
          }),
          React.createElement(RandomTablesPanel, {
            tables: currentSessionData.tables,
            setTables: setTables,
            addLogEntry: addPlayLogEntry
          }),
          React.createElement(ResourceTrackerPanel, {
            trackers: currentSessionData.resourceTrackers,
            setTrackers: setResourceTrackers,
            addLogEntry: addPlayLogEntry
          }),
          (currentSessionData.loadedGameDataPackage && currentSessionData.loadedGameDataPackage.rulebookSections && currentSessionData.loadedGameDataPackage.rulebookSections.length > 0) && 
            React.createElement(RulebookPanel, {
              rulebookSections: currentSessionData.loadedGameDataPackage.rulebookSections
            })
        ),
        React.createElement('main', { className: "w-full lg:w-2/3 flex flex-col min-h-0" },
          React.createElement(PlayLog, {
            playLogEntries: currentSessionData.playLogEntries,
            playLogTitle: currentSessionData.playLogTitle,
            onPlayLogTitleChange: setPlayLogTitle,
            onAddEntry: addPlayLogEntry,
            onUpdateEntry: updatePlayLogEntry,
            onDeleteEntry: deletePlayLogEntry,
            onUndo: handleUndo,
            onRedo: handleRedo,
            canUndo: currentSessionIndex > 0,
            canRedo: currentSessionIndex < sessionHistory.length - 1,
            characterSheet: currentSessionData.characterSheet,
            currentTheme: currentSessionData.theme
          })
        )
      )
    )
  );
};
// --- End of App.js content ---

const container = document.getElementById('root');
if (!container) {
  console.error("index.js: Failed to find the root element for React.") 
  throw new Error("Failed to find the root element");
}
console.log("index.js: Root element found. Creating React root and rendering App."); 
const root = createRoot(container);
root.render(React.createElement(StrictMode, null, React.createElement(App)));
console.log("index.js: App rendering initiated.");
    