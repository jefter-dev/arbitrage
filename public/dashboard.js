/**
 * @file This script implements the MVVM (Model-View-ViewModel) pattern to create a dynamic
 * dashboard for displaying arbitrage opportunities.
 * @author Jéfter Lucas/Jefter dev
 * @version 1.0.0
 */

// --- GLOBAL CONSTANTS AND CONFIGURATION ---

/**
 * The base URL for the backend API.
 * @type {string}
 */
const API_BASE_URL = '/api';

/**
 * A default trading fee percentage used for profit simulation.
 * @type {number}
 */
const TRADING_FEE_PERCENTAGE = 0.1;


// --- MODEL (M) - Data Access Layer ---

/**
 * Responsible for communicating with the backend API to fetch arbitrage data.
 * It is completely unaware of the HTML or the UI.
 */
class OpportunityService {
    /**
     * Fetches the list of executable opportunities from the API.
     * @returns {Promise<Array>} A promise that resolves to an array of executable opportunities.
     */
    async fetchExecutable() {
        const response = await fetch(`${API_BASE_URL}/opportunities/executable`, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Failed to fetch executable opportunities.');
        return response.json();
    }

    /**
     * Fetches the list of potential opportunities from the API.
     * @returns {Promise<Array>} A promise that resolves to an array of potential opportunities.
     */
    async fetchPotential() {
        const response = await fetch(`${API_BASE_URL}/opportunities/potential`, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Failed to fetch potential opportunities.');
        return response.json();
    }
}


// --- VIEW (V) - Rendering Layer ---

/**
 * Responsible for all DOM manipulation and rendering logic.
 * It receives data and turns it into HTML. It does not contain any application state.
 */
class OpportunityView {
    constructor() {
        this.exchangeColors = {
            binance: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
            kucoin: 'bg-green-500/10 text-green-400 border-green-500/30',
            kraken: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
            bybit: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
            okx: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            mexc: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
            bitget: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
            coinbase: 'bg-blue-600/10 text-blue-500 border-blue-600/30',
            default: 'bg-slate-600/10 text-slate-400 border-slate-600/30'
        };
        this.exchangeTradeUrls = {
            binance: (s) => `https://www.binance.com/en/trade/${s.replace('/', '_')}`,
            kucoin: (s) => `https://www.kucoin.com/trade/${s.replace('/', '-')}`,
            kraken: (s) => `https://trade.kraken.com/pt-BR/charts/KRAKEN:${s.replace('/', '-')}`,
            bybit: (s) => `https://www.bybit.com/en/trade/spot/${s.replace('_', '/')}`,
            okx: (s) => `https://www.okx.com/trade-spot/${s.replace('/', '-')}`,
            mexc: (s) => `https://www.mexc.com/pt-BR/exchange/${s.replace('/', '_')}`,
            bitget: (s) => `https://www.bitget.com/pt/spot/${s.replace('/', '')}`,
            coinbase: (s) => `https://www.coinbase.com/price/${s.split('/')[0].toLowerCase()}`,
        };
    }

    /**
     * Creates a styled HTML badge for an exchange, with an optional link to its trading page.
     * @param {string} exchangeName - The name of the exchange.
     * @param {string|null} symbol - The trading pair symbol.
     * @returns {string} The generated HTML string for the badge.
     */
    createExchangeBadge(exchangeName, symbol = null) {
        const colors = this.exchangeColors[exchangeName.toLowerCase()] || this.exchangeColors.default;
        const tradeUrlFn = this.exchangeTradeUrls[exchangeName.toLowerCase()];
        const url = (symbol && tradeUrlFn) ? tradeUrlFn(symbol) : null;
        const badge = `<span class="inline-block px-3 py-1 text-sm font-semibold rounded-full border text-center ${colors}">${exchangeName.toUpperCase()}</span>`;
        return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" title="Trade on ${exchangeName}">${badge}</a>` : badge;
    }

    /**
     * Populates the exchange legend area with styled badges for all monitored exchanges.
     */
    populateExchangeLegend() {
        const container = document.getElementById('exchange-legend-container');
        container.innerHTML = Object.keys(this.exchangeColors)
            .filter(name => name !== 'default')
            .map(name => this.createExchangeBadge(name))
            .join('');
    }

    /**
     * An adapter function that transforms raw asset info from various exchange APIs
     * into a single, standardized format for easier use in the UI.
     * @param {string} exchangeName - The name of the exchange the data comes from.
     * @param {Object} rawAssetInfo - The raw, unformatted asset data from the backend.
     * @returns {Object|null} A standardized asset info object, or null.
     */
    mapAssetInfo(exchangeName, rawAssetInfo) {
        if (!rawAssetInfo) return null;
        const standardized = { coin: '', fullName: '', networks: [] };
        const lowerCaseExchange = exchangeName.toLowerCase();
        switch (lowerCaseExchange) {
            case 'binance': case 'mexc':
                standardized.coin = rawAssetInfo.coin;
                standardized.fullName = rawAssetInfo.name;
                standardized.networks = (rawAssetInfo.networkList ?? []).map(net => ({ network: net.network.toUpperCase(), displayName: net.name || net.network, contractAddress: net.contractAddress || net.contract || 'N/A', withdrawEnabled: net.withdrawEnable, depositEnabled: net.depositEnable, withdrawFee: net.withdrawFee || 'N/A', withdrawMin: net.withdrawMin || 'N/A' }));
                break;
            case 'kucoin':
                standardized.coin = rawAssetInfo.currency;
                standardized.fullName = rawAssetInfo.fullName;
                standardized.networks = (rawAssetInfo.chains ?? []).map(chain => ({ network: chain.chainName.toUpperCase(), displayName: chain.chainName, contractAddress: chain.contractAddress || 'N/A', withdrawEnabled: chain.isWithdrawEnabled, depositEnabled: chain.isDepositEnabled, withdrawFee: chain.withdrawalMinFee || 'N/A', withdrawMin: chain.withdrawalMinSize || 'N/A' }));
                break;
            case 'bybit': case 'bitget':
                standardized.coin = rawAssetInfo.coin;
                standardized.fullName = rawAssetInfo.name;
                standardized.networks = (rawAssetInfo.chains ?? []).map(chain => ({ network: chain.chain.toUpperCase(), displayName: chain.chainType || chain.chain, contractAddress: chain.contractAddress || 'N/A', withdrawEnabled: chain.chainWithdraw === '1' || chain.withdrawable === 'true', depositEnabled: chain.chainDeposit === '1' || chain.rechargeable === 'true', withdrawFee: chain.withdrawFee || 'N/A', withdrawMin: chain.withdrawMin || 'N/A' }));
                break;
            default: return { coin: 'N/A', fullName: 'N/A', networks: [] };
        }
        return standardized;
    }

    /**
     * Generates the complete inner HTML for a single opportunity card.
     * @param {Object} op - The opportunity data object.
     * @param {boolean} isPotential - A flag to apply styles for potential opportunities.
     * @returns {string} The generated HTML string for the card.
     */
    createCardHTML(op, isPotential) {
        const validation = op.validation;
        if (!validation) return '';

        const buyBaseAsset = this.mapAssetInfo(op.buyAt.exchange, validation.assetDetails?.baseAsset?.buyExchange);
        const sellBaseAsset = this.mapAssetInfo(op.sellAt.exchange, validation.assetDetails?.baseAsset?.sellExchange);
        const assetFullName = buyBaseAsset?.fullName || sellBaseAsset?.fullName || '';
        const commonNetworks = validation.commonNetworks || [];

        const commonNetworksHTML = commonNetworks.length > 0 ? commonNetworks.map(net => {
            const buyNet = buyBaseAsset?.networks.find(n => n.network === net);
            const sellNet = sellBaseAsset?.networks.find(n => n.network === net);
            if (!buyNet || !sellNet) return '';
            const [assetSymbol, quoteSymbol] = op.pair.split('/');
            let sellFeeInQuote = 'N/A';
            if (['USDT', 'USDC'].includes(quoteSymbol.toUpperCase()) && op.sellAt.price && sellNet.withdrawFee !== 'N/A') {
                sellFeeInQuote = (parseFloat(sellNet.withdrawFee) * op.sellAt.price).toFixed(2);
            }
            const sellFeeDisplay = `${sellNet.withdrawFee} ${assetSymbol} ${sellFeeInQuote !== 'N/A' ? `<span class="font-bold text-yellow-400">(~ ${quoteSymbol} ${sellFeeInQuote})</span>` : ''}`;
            return `
                <div class="mt-2 p-2 bg-slate-800/50 rounded-md text-xs space-y-1">
                    <p class="font-bold text-cyan-400">${sellNet.displayName}</p>
                    <p class="text-slate-400 break-words">
                        Contract (${op.buyAt.exchange}): <span class="font-mono">${buyNet.contractAddress}</span>
                    </p>
                    <p class="text-slate-400 break-words">
                        Contract (${op.sellAt.exchange}): <span class="font-mono">${sellNet.contractAddress}</span>
                    </p>
                    <p><span class="text-slate-400">Withdrawal Fee (${op.sellAt.exchange}):</span> ${sellFeeDisplay}</p>
                </div>`;
        }).join('') : '<p class="text-xs text-slate-500">No compatible networks found.</p>';

        const calculatorDisabled = isPotential || commonNetworks.length === 0;
        const [assetSymbol, quoteSymbol] = op.pair.split('/');
        const calculatorHTML = `
            <div class="mt-4 pt-4 border-t border-slate-700">
                <h4 class="text-sm font-semibold text-slate-300 mb-2">Profit Simulator</h4>
                <div class="flex items-center gap-2">
                    <input type="number" data-id="calc-input" placeholder="Amount in ${quoteSymbol}" ${calculatorDisabled ? 'disabled' : ''} class="w-full bg-slate-700 text-white p-2 rounded-md border border-slate-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono disabled:opacity-50 disabled:cursor-not-allowed">
                    <button data-id="calc-btn" ${calculatorDisabled ? 'disabled' : ''} class="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:bg-slate-600 disabled:cursor-not-allowed">Calculate</button>
                </div>
                <div data-id="calc-result" class="mt-2 text-xs text-slate-400 space-y-1">${calculatorDisabled ? '<p class="text-orange-400">Simulation unavailable.</p>' : ''}</div>
            </div>`;

        const potentialClasses = isPotential ? 'opacity-60 grayscale' : '';
        const potentialIcon = isPotential ? `<div class="absolute top-3 right-3 text-orange-400" title="Inactive wallet or no common network"><svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>` : '';

        return `
            <div class="cursor-pointer relative bg-slate-900 p-6 rounded-xl shadow-lg border border-slate-800 flex flex-col justify-between transition-all duration-300 hover:border-cyan-500/50 hover:shadow-cyan-500/10 ${potentialClasses}">
                ${potentialIcon}
                <div>
                    <h2 class="text-2xl font-bold text-slate-100 mb-4">${op.pair} <span class="text-sm font-normal text-slate-400">${assetFullName}</span></h2>
                    <div class="space-y-3 text-slate-300">
                        <div class="flex items-center justify-between"><span class="font-semibold text-green-400">BUY AT:</span>${this.createExchangeBadge(op.buyAt.exchange, op.pair)}</div>
                        <p class="text-right font-mono text-lg">${op.buyAt.price}</p>
                        <div class="flex items-center justify-between"><span class="font-semibold text-red-400">SELL AT:</span>${this.createExchangeBadge(op.sellAt.exchange, op.pair)}</div>
                        <p class="text-right font-mono text-lg">${op.sellAt.price}</p>
                    </div>
                    <div class="mt-4 pt-2 border-t border-slate-800">
                        <h4 class="text-sm font-semibold text-slate-300">Transfer Networks (Base Asset):</h4>
                        ${commonNetworksHTML}
                    </div>
                </div>
                <div class="mt-4 pt-4 border-t border-slate-800">
                    <div class="flex justify-between items-baseline">
                        <span class="text-lg font-bold text-yellow-400">Gross Profit:</span>
                        <span class="text-2xl font-bold text-yellow-300 font-mono">${op.profitPercentage}%</span>
                    </div>
                </div>
                ${calculatorHTML}
            </div>`;
    }

    /**
     * Renders a list of opportunities into a specified container element.
     * @param {HTMLElement} container - The DOM element to render into.
     * @param {Array} opportunities - The array of opportunity objects.
     * @param {boolean} isPotential - A flag to indicate if these are potential opportunities.
     * @param {DashboardViewModel} viewModel - The viewModel instance to bind events to.
     */
    render(container, opportunities, isPotential, viewModel) {
        container.innerHTML = '';
        if (!opportunities || opportunities.length === 0) {
            container.innerHTML = `<p class="col-span-full text-center text-slate-600 text-lg">No opportunities found.</p>`;
            return;
        }
        opportunities
            .sort((a, b) => b.profitPercentage - a.profitPercentage)
            .forEach((op) => {
                const cardHTML = this.createCardHTML(op, isPotential);
                const wrapper = document.createElement('div');
                wrapper.innerHTML = cardHTML.trim();
                const cardElement = wrapper.firstElementChild;
                this.bindCardEvents(cardElement, op, viewModel);
                container.appendChild(cardElement);
            });
    }

    /**
     * Binds click events for the calculator and the details overlay to a card element.
     * @param {HTMLElement} cardElement - The newly created card element.
     * @param {Object} op - The opportunity data associated with this card.
     * @param {DashboardViewModel} viewModel - The viewModel instance containing the event handler logic.
     */
    bindCardEvents(cardElement, op, viewModel) {
        const calcButton = cardElement.querySelector(`button[data-id="calc-btn"]`);
        if (calcButton) {
            calcButton.addEventListener('click', () => {
                const amount = cardElement.querySelector(`input[data-id="calc-input"]`).value;
                viewModel.calculateProfit(op, amount, cardElement);
            });
        }
        cardElement.addEventListener('click', (event) => {
            if (event.target.closest('a, button, input')) return;
            viewModel.showOpportunityDetails(cardElement);
        });
    }

    /**
     * Updates the result area of a card's profit calculator.
     * @param {HTMLElement} cardElement - The card element containing the calculator.
     * @param {string} html - The new HTML content to display in the result area.
     */
    updateCalculationResult(cardElement, html) {
        const resultElement = cardElement.querySelector('[data-id="calc-result"]');
        if (resultElement) resultElement.innerHTML = html;
    }

    /**
     * Displays a loading spinner inside a container.
     * @param {HTMLElement} container - The container to display the loader in.
     */
    showLoading(container) {
        container.innerHTML = `<div class="col-span-full flex justify-center items-center p-8"><div class="loader h-12 w-12 rounded-full border-4 border-slate-700"></div></div>`;
    }

    /**
     * Displays an error message inside a container.
     * @param {HTMLElement} container - The container to display the error in.
     * @param {string} message - The error message to display.
     */
    showError(container, message) {
        container.innerHTML = `<p class="col-span-full text-center text-red-500">${message}</p>`;
    }
}


// --- VIEWMODEL (VM) - UI Brains ---

/**
 * The ViewModel connects the Model (data services) and the View (rendering).
 * It holds the application state, contains the UI logic, and exposes commands
 * for the View to use.
 */
class DashboardViewModel {
    constructor(service, view) {
        this.service = service;
        this.view = view;
        this.executableOpportunities = [];
        this.potentialOpportunities = [];
        this.calculatorData = {};
        this.executableContainer = document.getElementById('executable-opportunities-container');
        this.potentialContainer = document.getElementById('potential-opportunities-container');
        this.lastUpdatedEl = document.getElementById('last-updated');
        this.overlay = document.getElementById('opportunity-overlay');
        this.highlighted = document.getElementById('highlighted-opportunity');
    }

    /**
     * Initializes the application by binding global events and performing the
     * initial data fetch.
     */
    async init() {
        this.bindGlobalEvents();
        this.view.populateExchangeLegend();
        await this.fetchOpportunities();
    }

    /**
     * Binds event listeners to global UI elements like buttons and the overlay.
     */
    bindGlobalEvents() {
        document.getElementById('calculate-all-btn').addEventListener('click', () => {
            const amount = document.getElementById('global-amount-input').value;
            this.calculateAll(amount);
        });
        document.querySelector('.refresh-btn').addEventListener('click', () => this.fetchOpportunities());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hideOpportunityDetails();
        });
    }

    /**
     * Orchestrates fetching both executable and potential opportunities, updating
     * the application state, and triggering the view to render the new data.
     */
    async fetchOpportunities() {
        this.view.showLoading(this.executableContainer);
        this.view.showLoading(this.potentialContainer);
        this.lastUpdatedEl.textContent = 'Loading...';
        try {
            const [execData, potData] = await Promise.all([
                this.service.fetchExecutable(),
                this.service.fetchPotential()
            ]);
            this.executableOpportunities = execData;
            this.potentialOpportunities = potData;
            this.updateCalculatorData();
            this.view.render(this.executableContainer, this.executableOpportunities, false, this);
            this.view.render(this.potentialContainer, this.potentialOpportunities, true, this);
            this.lastUpdatedEl.textContent = `Last updated: ${new Date().toLocaleTimeString('en-US')}`;
        } catch (error) {
            console.error("Error loading opportunities:", error);
            const msg = "Failed to load data. Is the API server running?";
            this.view.showError(this.executableContainer, msg);
            this.view.showError(this.potentialContainer, "");
        }
    }

    /**
     * Pre-processes the fetched opportunities to store the necessary data for the
     * profit calculator, improving performance by avoiding repeated searches.
     */
    updateCalculatorData() {
        this.calculatorData = {};
        const allOps = [...this.executableOpportunities, ...this.potentialOpportunities];
        allOps.forEach(op => {
            if (!op.validation) return;
            const safeSymbol = op.pair.replace('/', '-');
            const uniqueId = `${safeSymbol}-${op.buyAt.exchange}-${op.sellAt.exchange}`;
            const sellBaseAsset = this.view.mapAssetInfo(op.sellAt.exchange, op.validation.assetDetails?.baseAsset?.sellExchange);
            const commonNetworks = op.validation.commonNetworks || [];
            if (commonNetworks.length > 0) {
                const sellNet = sellBaseAsset?.networks.find(n => n.network === commonNetworks[0]);
                if (sellNet) this.calculatorData[uniqueId] = { op, sellNet };
            }
        });
    }

    /**
     * Contains the business logic for calculating the net profit of a single arbitrage
     * opportunity based on a user-provided amount.
     * @param {Object} op - The opportunity object.
     * @param {string} initialAmountStr - The initial investment amount as a string.
     * @param {HTMLElement} cardElement - The card element to update with the result.
     */
    calculateProfit(op, initialAmountStr, cardElement) {
        const safeSymbol = op.pair.replace('/', '-');
        const uniqueId = `${safeSymbol}-${op.buyAt.exchange}-${op.sellAt.exchange}`;
        const data = this.calculatorData[uniqueId];

        if (!data) return;

        const initialAmount = parseFloat(initialAmountStr);
        if (!initialAmount || initialAmount <= 0) {
            this.view.updateCalculationResult(cardElement, '<p class="text-red-400">Please enter a valid initial amount.</p>');
            return;
        }

        const { sellNet } = data;
        const [assetSymbol, quoteSymbol] = op.pair.split('/');
        const tradingFee = TRADING_FEE_PERCENTAGE / 100;
        const withdrawFee = parseFloat(sellNet.withdrawFee) || 0;
        const amountBought = initialAmount / op.buyAt.price;
        const buyTradeFee = amountBought * tradingFee;
        const amountAfterBuyFee = amountBought - buyTradeFee;
        const amountToTransfer = amountAfterBuyFee - withdrawFee;

        if (amountToTransfer <= 0) {
            this.view.updateCalculationResult(cardElement, '<p class="text-red-400">Amount too small to cover withdrawal fee.</p>');
            return;
        }

        const grossSellValue = amountToTransfer * op.sellAt.price;
        const sellTradeFee = grossSellValue * tradingFee;
        const netSellValue = grossSellValue - sellTradeFee;
        const finalProfit = netSellValue - initialAmount;
        const resultHTML = `
            <p>Initial amount: <span class="font-mono">${initialAmount.toFixed(2)} ${quoteSymbol}</span></p>
            <p>Bought (${op.buyAt.exchange}): <span class="font-mono">${amountBought.toFixed(6)} ${assetSymbol}</span> (Fee: ${buyTradeFee.toFixed(6)} ${assetSymbol})</p>
            <p>Withdrawal (${op.sellAt.exchange}): <span class="font-mono">-${withdrawFee.toFixed(6)} ${assetSymbol}</span></p>
            <p>Sold (${op.sellAt.exchange}): <span class="font-mono">${grossSellValue.toFixed(2)} ${quoteSymbol}</span> (Fee: ${sellTradeFee.toFixed(2)} ${quoteSymbol})</p>
            <p class="text-base mt-2 pt-2 border-t border-slate-700">
                <span class="font-bold ${finalProfit > 0 ? 'text-green-400' : 'text-red-400'}">FINAL PROFIT:</span>
                <span class="font-mono font-bold ${finalProfit > 0 ? 'text-green-400' : 'text-red-400'}">${finalProfit.toFixed(2)} ${quoteSymbol}</span>
            </p>`;
        this.view.updateCalculationResult(cardElement, resultHTML);
    }

    /**
     * A command that applies a global investment amount to all executable
     * opportunity calculators.
     * @param {string} amount - The global amount to simulate.
     */
    calculateAll(amount) {
        if (!amount || amount <= 0) return;
        document.querySelectorAll('#executable-opportunities-container input[data-id="calc-input"]:not(:disabled)').forEach(input => {
            input.value = amount;
            input.nextElementSibling.click();
        });
    }

    /**
     * A command to display the details of a selected opportunity in a modal overlay.
     * @param {HTMLElement} cardElement - The card element that was clicked.
     */
    showOpportunityDetails(cardElement) {
        const clone = cardElement.cloneNode(true);
        clone.classList.remove('cursor-pointer');
        this.highlighted.innerHTML = '';
        this.highlighted.appendChild(clone);
        this.overlay.classList.remove('hidden');
        this.overlay.style.opacity = '1';
    }

    /**
     * A command to hide the opportunity details overlay.
     */
    hideOpportunityDetails() {
        this.overlay.style.opacity = '0';
        setTimeout(() => this.overlay.classList.add('hidden'), 300);
    }
}


// --- APPLICATION INITIALIZATION ---

/**
 * The entry point of the frontend application. It waits for the DOM to be fully
 * loaded, then creates instances of the Model, View, and ViewModel, and
 * starts the application by calling `viewModel.init()`.
 */
document.addEventListener('DOMContentLoaded', () => {
    const service = new OpportunityService();
    const view = new OpportunityView();
    const viewModel = new DashboardViewModel(service, view);
    viewModel.init();
});