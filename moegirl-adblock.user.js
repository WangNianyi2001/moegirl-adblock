// ==UserScript==
// @name         萌娘百科广告屏蔽
// @version      v0.1.0-20260612
// @description  屏蔽萌娘百科里动态加载的广告
// @author       Nianyi Wang
// @match        https://zh.moegirl.org.cn/*
// @run-at       document-idle
// ==/UserScript==

(function() {
	'use strict';

	const container = document.getElementById('moe-main-container');
	const article = document.getElementById('moe-article');

	/** @type {(string | RegExp)[]} */
	const adKeywords = ['推广', '推廣', /^Ads$/i, /^Promotions$/i];

	/** @type {{[selector: string]: {[key: string]: string}}} */
	const globalCssInject = {
		'body': {
			'overflow': 'auto',
		},
	};

	const INITIAL_INTERVAL_MS = 100;
	const STARTUP_FIXED_PHASE_MS = 5000;
	const INTERVAL_MULTIPLIER = 1.5;

	async function Main() {
		// 先固定频率检测，直到首次命中或超时
		const startupDeadline = Date.now() + STARTUP_FIXED_PHASE_MS;
		for(; Date.now() < startupDeadline; ) {
			if(Execute())
				break;
			await Wait(INITIAL_INTERVAL_MS);
		}

		// 进入变频阶段：未命中则放慢，命中则恢复初始频率
		let intervalMs = INITIAL_INTERVAL_MS;
		for(; ; ) {
			const hasBlocked = Execute();
			intervalMs = hasBlocked ? INITIAL_INTERVAL_MS : intervalMs * INTERVAL_MULTIPLIER;
			await Wait(intervalMs);
		}
	}
	Main();

	/** @returns {number} 不对的样式数量 */
	function InjectGlobalCss() {
		let mismatchCount = 0;
		for(const [selector, styles] of Object.entries(globalCssInject)) {
			for(const e of document.querySelectorAll(selector)) {
				for(const [key, val] of Object.entries(styles)) {
					if(e.style.getPropertyValue(key) === val)
						continue;
					++mismatchCount;
					e.style.setProperty(key, val, 'important');
				}
			}
		}
		return mismatchCount;
	}

	function Wait(milliseconds) {
		return new Promise(resolve => setTimeout(resolve, milliseconds));
	}

	/** @returns {bool} 是否执行有效操作 */
	function Execute() {
		let targetCount = 0;

		console.log('Detecting ads...');

		targetCount += InjectGlobalCss();

		for(const a of FindAdRoots()) {
			a.style.setProperty('display', 'none', 'important');
			++targetCount;
		}

		console.log(`Blocked ${targetCount} ads.`);

		return targetCount > 0;
	}

	/** @returns {Iterable<HTMLElement>} */
	function *FindAdRoots() {
		for(const e of GetPotentialDirectAdElements()) {
			const root = GetAdRoot(e);
			if(!root)
				continue;
			if(root.style.getPropertyValue('display'))
				continue;
			yield root;
		}
	}

	/**
	 * @param {HTMLElement} e 
	 * @returns {HTMLElement | null}
	 */
	function GetAdRoot(e) {
		const parents = GetParentChain(e);
		for(const [i, p] of parents.entries()) {
			if(['moe-card', 'fc-ab-root'].some(c => p.classList.contains(c)))
				return p;
			const next = i === parents.length - 1 ? null : parents[i + 1];
			if(
				next === article ||
				next === container ||
				next === document.body
			)
				return p;
		}
		return null;
	}

	/** @returns {Iterable<HTMLElement>} */
	function *GetPotentialDirectAdElements() {
		for(const a of document.getElementsByTagName('a')) {
			const innerText = a.innerText
			if(!adKeywords.some(k => innerText.match(k)))
				continue;
			yield a;
		}
		for(const ab of document.getElementsByClassName('fc-ab-root'))
			yield ab;
	}

	/**
	 * @param {HTMLElement} e 
	 * @returns {HTMLElement[]}
	 */
	function GetParentChain(e) {
		if(!e)
			return [];
		const chain = [];
		for(let current = e; current; current = current.parentElement)
			chain.push(current);
		return chain;
	}
})();