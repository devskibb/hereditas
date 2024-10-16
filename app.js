// Contract Addresses
const factoryAddress = "0xB30e7E3ae76c3d6Be2D70ABA661cd154B61e0f39"; // InheritanceFactory on Mainnet

// Contract ABIs
let factoryABI;
let inheritanceABI;
let erc20ABI;
let factoryContractReadOnly;

// Load ABIs Asynchronously
const loadABIs = async () => {
    try {
        // Fetch ABI JSON file for the factory
        const factoryResponse = await fetch('./contracts/InheritanceFactory.json');
        factoryABI = await factoryResponse.json();

        // Fetch ABI JSON file for inheritance
        const inheritanceResponse = await fetch('./contracts/InheritanceContract.json');
        inheritanceABI = await inheritanceResponse.json();

        // Fetch ERC20 ABI
        const erc20Response = await fetch('./contracts/erc20ABI.json');
        erc20ABI = await erc20Response.json();

        console.log("ABIs loaded successfully.", factoryABI, inheritanceABI, erc20ABI);

        // Enable Connect Wallet button after ABIs are loaded
        document.getElementById('connect-wallet').disabled = false;
    } catch (error) {
        console.error("Error loading ABIs:", error);
        alert("Failed to load contract ABIs. Please check the console for details.");
    }
};

// Call loadABIs on script load
loadABIs();

// Global Variables
let provider;
let signer;
let factoryContract;

// DOM Elements
const connectWalletButton = document.getElementById('connect-wallet');
const walletAddressDisplay = document.getElementById('wallet-address');

const createContractForm = document.getElementById('create-contract-form');
const createStatus = document.getElementById('create-status');

const contractsListDiv = document.getElementById('contracts-list');

// Disable Connect Wallet button until ABIs are loaded
connectWalletButton.disabled = true;

let isConnected = false;

// Connect/Disconnect Wallet
connectWalletButton.addEventListener('click', async () => {
    if (!isConnected) {
        // **Connect Wallet**
        if (window.ethereum) {
            try {
                // Request account access
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                walletAddressDisplay.textContent = `Connected: ${account}`;

                // Initialize Ethers provider and signer
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();

                // Log provider and signer to ensure they're defined
                console.log("Provider:", provider);
                console.log("Signer:", signer);

                // Initialize Factory Contract (for reading - use provider)
                if (!factoryABI || !Array.isArray(factoryABI)) {
                    throw new Error("Invalid Factory ABI loaded. Please check the ABI format.");
                }
                // Assign to global variable
                factoryContractReadOnly = new ethers.Contract(factoryAddress, factoryABI, provider);
                // Contract for write operations
                factoryContract = new ethers.Contract(factoryAddress, factoryABI, signer);

                // Update UI: Change button text to "Disconnect Wallet"
                connectWalletButton.textContent = "Disconnect Wallet";

                // Display User's Contracts
                await displayUserContracts(factoryContractReadOnly, account);

                // Display Contracts Where User is a Beneficiary
                await displayBeneficiaryContracts(factoryContractReadOnly, account);

                // Set connection state
                isConnected = true;

                // Listen for account changes
                window.ethereum.on('accountsChanged', handleAccountsChanged);

                // Listen for network changes
                window.ethereum.on('chainChanged', handleChainChanged);

            } catch (error) {
                console.error("Error connecting wallet:", error);
                walletAddressDisplay.textContent = "Connection Failed";
            }
        } else {
            alert("Please install MetaMask!");
        }
    } else {
        // **Disconnect Wallet**
        try {
            // Reset the UI
            walletAddressDisplay.textContent = "Not connected";
            connectWalletButton.textContent = "Connect Wallet";

            // Reset state variables
            provider = null;
            signer = null;
            factoryContractReadOnly = null;
            factoryContract = null;

            // Remove event listeners
            if (window.ethereum && window.ethereum.removeListener) {
                window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
                window.ethereum.removeListener('chainChanged', handleChainChanged);
            }

            // Clear contracts lists
            contractsListDiv.innerHTML = "";
            beneficiaryContractsListDiv.innerHTML = "";

            // Update connection state
            isConnected = false;

        } catch (error) {
            console.error("Error disconnecting wallet:", error);
            alert("Failed to disconnect wallet.");
        }
    }
});


// Function to initialize toggle behavior
function initializeToggles() {
    // Select all headers with the class 'toggle-header'
    const toggleHeaders = document.querySelectorAll('.toggle-header');

    toggleHeaders.forEach(header => {
        // Initially collapse all sections
        const section = header.parentElement;
        section.classList.add('collapsed');

        header.addEventListener('click', () => {
            // Toggle the 'active' class on the clicked section
            const isActive = section.classList.contains('active');

            // Collapse all sections
            toggleHeaders.forEach(h => {
                const sec = h.parentElement;
                sec.classList.remove('active');
                sec.classList.add('collapsed');
            });

            if (!isActive) {
                // Expand the clicked section
                section.classList.add('active');
                section.classList.remove('collapsed');
            }
        });
    });
}

// Call initializeToggles after the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeToggles();
});

// Handle account changes
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        walletAddressDisplay.textContent = "Disconnected";
        contractsListDiv.innerHTML = "<p>Disconnected from wallet.</p>";
        beneficiaryContractsListDiv.innerHTML = "<p>Disconnected from wallet.</p>";
    } else {
        walletAddressDisplay.textContent = `Connected: ${accounts[0]}`;
        // Refresh the UI using the global factoryContractReadOnly
        displayUserContracts(factoryContractReadOnly, accounts[0]);
        displayBeneficiaryContracts(factoryContractReadOnly, accounts[0]);
    }
}


// Handle network changes
function handleChainChanged(_chainId) {
    window.location.reload();
}

// Fetch Beneficiaries using getAllBeneficiaries function
async function getAllBeneficiaries(contract) {
    try {
        const beneficiaries = await contract.getAllBeneficiaries();
        // beneficiaries is an array of structs with 'beneficiaryAddress' and 'share'
        return beneficiaries;
    } catch (error) {
        console.error("Error fetching beneficiaries:", error);
        return [];
    }
}

async function fetchTokensInfo(inheritanceContract, contractAddress) {
    let tokensInfo = [];
    try {
        // Get the array of deposited tokens
        const depositedTokens = await inheritanceContract.getDepositedTokens();

        for (const tokenAddress of depositedTokens) {
            const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);

            // Fetch token details and balance
            const [name, symbol, decimals, balance] = await Promise.all([
                tokenContract.name(),
                tokenContract.symbol(),
                tokenContract.decimals(),
                tokenContract.balanceOf(contractAddress)
            ]);

            const formattedBalance = ethers.formatUnits(balance, decimals);
            tokensInfo.push({ tokenAddress, name, symbol, decimals, balance: formattedBalance });
        }
    } catch (error) {
        console.error("Error fetching deposited tokens:", error);
    }
    return tokensInfo;
}


// Function to load ERC20 token details
async function loadTokenDetails(tokenAddress) {
    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, provider);
    const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
    ]);
    return { name, symbol, decimals, address: tokenAddress };
}

// DOM Element for Beneficiary Contracts
const beneficiaryContractsListDiv = document.getElementById('beneficiary-contracts-list');

// Initialize a centralized list to hold all countdown update functions
const countdownTimers = [];

// Centralized timer to update all countdowns every second
setInterval(() => {
    countdownTimers.forEach(timer => timer.update());
}, 1000);

/**
 * Initializes a countdown timer for a specific inheritance contract.
 * @param {number} targetTimestamp - The Unix timestamp (in seconds) when inheritance can be distributed.
 * @param {HTMLElement} countdownElement - The DOM element where the countdown will be displayed.
 * @param {HTMLButtonElement} buttonElement - The "Distribute Inheritance" button.
 */
function initializeCountdownTimer(targetTimestamp, countdownElement, buttonElement) {
    // Define the update function
    const updateCountdown = () => {
        const currentTime = Math.floor(Date.now() / 1000);
        let remainingTime = targetTimestamp - currentTime;

        if (remainingTime <= 0) {
            countdownElement.textContent = "You can distribute the inheritance now.";
            buttonElement.disabled = false;
            buttonElement.textContent = "Distribute Inheritance";
            // Remove this timer from the list as it's no longer needed
            const index = countdownTimers.findIndex(timer => timer.update === updateCountdown);
            if (index !== -1) {
                countdownTimers.splice(index, 1);
            }
        } else {
            // Calculate days, hours, minutes, and seconds
            const days = Math.floor(remainingTime / 86400);
            const hours = Math.floor((remainingTime % 86400) / 3600);
            const minutes = Math.floor((remainingTime % 3600) / 60);
            const seconds = remainingTime % 60;

            countdownElement.textContent = `Time until distribution: ${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
    };

    // Add the update function to the centralized list
    countdownTimers.push({ update: updateCountdown });

    // Initial call to set the countdown immediately
    updateCountdown();
}

// Function to display Contracts where the user is a Beneficiary
async function displayBeneficiaryContracts(factoryContractReadOnly, userAddress) {
    if (!factoryContractReadOnly) return;

    beneficiaryContractsListDiv.innerHTML = "<p>Loading beneficiary contracts...</p>";

    try {
        // Fetch contracts where the user is a beneficiary
        const beneficiaryContracts = await factoryContractReadOnly.getContractsByBeneficiary(userAddress);

        if (beneficiaryContracts.length === 0) {
            beneficiaryContractsListDiv.innerHTML = "<p>You are not a beneficiary in any inheritance contracts.</p>";
            return;
        }

        beneficiaryContractsListDiv.innerHTML = ""; // Clear loading message

        // Initialize Ethers provider
        const ethersProvider = new ethers.BrowserProvider(window.ethereum);

        // Iterate over beneficiary contracts and display details
        for (const contractAddress of beneficiaryContracts) {
            const inheritanceContract = new ethers.Contract(contractAddress, inheritanceABI, ethersProvider);

            // Check if assets have been distributed
            const isDistributed = await inheritanceContract.isDistributed();

            if (isDistributed) {
                console.log(`Contract ${contractAddress} has already been distributed. Skipping display.`);
                continue; // Skip to the next contract
            }

            // Fetch Beneficiaries
            const beneficiaries = await getAllBeneficiaries(inheritanceContract);

            // Fetch ETH Balance
            const ethBalance = await ethersProvider.getBalance(contractAddress);

            // Fetch Tokens Info
            const tokensInfo = await fetchTokensInfo(inheritanceContract, contractAddress);

            // Fetch Inactivity Period and Last Active Timestamp
            const lastActiveTimestampBigInt = await inheritanceContract.lastActiveTimestamp();
            const inactivityPeriodBigInt = await inheritanceContract.inactivityPeriod();
            const gracePeriodBigInt = await inheritanceContract.gracePeriod(); // Assuming you have a gracePeriod getter

            // Convert BigInt to Number for calculations
            const lastActiveTimestamp = Number(lastActiveTimestampBigInt);
            const inactivityPeriod = Number(inactivityPeriodBigInt);
            const gracePeriod = Number(gracePeriodBigInt);

            // Calculate target timestamp
            const targetTimestamp = lastActiveTimestamp + inactivityPeriod; // Unix timestamp in seconds

            // Create Contract Card
            const contractCard = document.createElement('div');
            contractCard.className = 'contract-card';
            contractCard.innerHTML = `
                <div class="contract-header">
                    <p>
                        <strong>Contract Address:</strong> ${contractAddress}
                        <span class="toggle-icon">▼</span>
                    </p>
                    <p><strong>ETH Balance:</strong> ${ethers.formatEther(ethBalance)} ETH</p>
                </div>
                <div class="contract-details" style="display: none;">
                    ${tokensInfo.length > 0 ? `
                        <div class="tokens-header">
                            <p><strong>Tokens:</strong> <span class="toggle-icon">▼</span></p>
                        </div>
                        <div class="tokens-details" style="display: none;">
                            <ul>
                                ${tokensInfo.map(token => {
                                    const tokenEtherscanLink = `https://etherscan.io/token/${token.tokenAddress}`;
                                    return `
                                        <li>
                                            <a href="${tokenEtherscanLink}" target="_blank" class="token-link">
                                                ${token.name} (${token.symbol})
                                            </a>: ${token.balance} ${token.symbol}
                                        </li>
                                    `;
                                }).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    <!-- Beneficiaries List -->
                    <p><strong>Beneficiaries:</strong></p>
                    <ul>
                        ${beneficiaries.map((b) => {
                            const sharePercentage = Number(b.share) / 100; // Convert basis points to percentage
                            const etherscanLink = `https://etherscan.io/address/${b.beneficiaryAddress}`;
                            return `
                                <li>
                                    <a href="${etherscanLink}" target="_blank" class="address-link">
                                        ${b.beneficiaryAddress}
                                    </a> - ${sharePercentage.toFixed(2)}%
                                </li>
                            `;
                        }).join('')}
                    </ul>

                    <!-- Distribute Inheritance Section -->
                    <div class="distribute-inheritance-section">
                        <p class="countdown-timer">Loading...</p>
                        <button class="distribute-button" disabled>Distribute Inheritance</button>
                        <p class="status-message"></p>
                    </div>
                </div>
            `;

            // Append contract card to the list
            beneficiaryContractsListDiv.appendChild(contractCard);

            // Toggle contract details
            const header = contractCard.querySelector('.contract-header');
            const details = contractCard.querySelector('.contract-details');
            const toggleIcon = header.querySelector('.toggle-icon');

            header.style.cursor = 'pointer';

            header.addEventListener('click', () => {
                if (details.style.display === 'none' || details.style.display === '') {
                    details.style.display = 'block';
                    toggleIcon.textContent = '▲'; // Change icon to up arrow
                } else {
                    details.style.display = 'none';
                    toggleIcon.textContent = '▼'; // Change icon to down arrow
                }
            });

            // Tokens Toggle (if any tokens exist)
            if (tokensInfo.length > 0) {
                const tokensHeader = details.querySelector('.tokens-header');
                const tokensDetails = details.querySelector('.tokens-details');
                const tokensToggleIcon = tokensHeader.querySelector('.toggle-icon');

                tokensHeader.style.cursor = 'pointer';

                tokensHeader.addEventListener('click', () => {
                    if (tokensDetails.style.display === 'none' || tokensDetails.style.display === '') {
                        tokensDetails.style.display = 'block';
                        tokensToggleIcon.textContent = '▲';
                    } else {
                        tokensDetails.style.display = 'none';
                        tokensToggleIcon.textContent = '▼';
                    }
                });
            }

            // Distribute Inheritance Section Elements
            const distributeSection = details.querySelector('.distribute-inheritance-section');
            const countdownTimer = distributeSection.querySelector('.countdown-timer');
            const distributeButton = distributeSection.querySelector('.distribute-button');
            const statusMessage = distributeSection.querySelector('.status-message');

            // Initialize Countdown Timer
            initializeCountdownTimer(targetTimestamp, countdownTimer, distributeButton, contractAddress, inheritanceContract, statusMessage);

            // Event Listener for Distribute Inheritance Button
            distributeButton.addEventListener('click', async () => {
                try {
                    distributeButton.disabled = true;
                    distributeButton.textContent = "Processing...";
                    statusMessage.textContent = "Transaction Submitted. Waiting for confirmation...";
                    statusMessage.style.color = "blue";

                    // Connect the contract with signer for write operations
                    const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                    const tx = await inheritanceContractSigner.distributeInheritance();
                    await tx.wait();

                    statusMessage.textContent = "Inheritance Distributed Successfully!";
                    statusMessage.style.color = "green";
                    distributeButton.textContent = "Inheritance Distributed";
                    distributeButton.disabled = true;
                    countdownTimer.textContent = "Inheritance has been distributed.";
                } catch (error) {
                    console.error("Error distributing inheritance:", error);
                    statusMessage.textContent = `Error: ${error.reason || error.message}`;
                    statusMessage.style.color = "red";
                    distributeButton.disabled = false;
                    distributeButton.textContent = "Distribute Inheritance";
                }
            });
        }

    } catch (error) {
        console.error("Error displaying beneficiary contracts:", error);
        beneficiaryContractsListDiv.innerHTML = "<p>Error fetching beneficiary contracts.</p>";
    }
}




async function displayUserContracts(factoryContractReadOnly, userAddress) {
    if (!factoryContractReadOnly) return;

    contractsListDiv.innerHTML = "";

    try {
        const contracts = await factoryContractReadOnly.getContractsByOwner(userAddress);

        if (contracts.length === 0) {
            contractsListDiv.innerHTML = "<p>You have not created any inheritance contracts yet.</p>";
            return;
        }

        // Initialize Ethers provider
        const ethersProvider = new ethers.BrowserProvider(window.ethereum);

        for (const contractAddress of contracts) {
            const inheritanceContract = new ethers.Contract(contractAddress, inheritanceABI, ethersProvider);

            // **1. Fetch isDistributed Status**
            const isDistributed = await inheritanceContract.isDistributed();

            // **2. Conditional Check: Skip if Distributed**
            if (isDistributed) {
                console.log(`Contract ${contractAddress} has already been distributed. Skipping display.`);
                continue; // Skip to the next contract
            }

            // **3. Proceed to Fetch and Display Contract Details**

            // Fetch Beneficiaries
            const beneficiaries = await getAllBeneficiaries(inheritanceContract);

            // Fetch ETH Balance
            const ethBalance = await ethersProvider.getBalance(contractAddress);

            // Fetch Tokens Info
            const tokensInfo = await fetchTokensInfo(inheritanceContract, contractAddress);

            // Fetch Inactivity Period and Last Active Timestamp
            const lastActiveTimestampBigInt = await inheritanceContract.lastActiveTimestamp();
            const inactivityPeriodBigInt = await inheritanceContract.inactivityPeriod();
            const gracePeriodBigInt = await inheritanceContract.gracePeriod(); // Assuming you have a gracePeriod getter

            // Convert BigInt to Number for calculations
            const lastActiveTimestamp = Number(lastActiveTimestampBigInt);
            const inactivityPeriod = Number(inactivityPeriodBigInt);
            const gracePeriod = Number(gracePeriodBigInt);

            // **4. Calculate Target Timestamp**
            const targetTimestamp = lastActiveTimestamp + inactivityPeriod; // Unix timestamp in seconds
            

            // **5. Create Contract Card**
            const contractCard = document.createElement('div');
            contractCard.className = 'contract-card';
            contractCard.innerHTML = `
                <div class="contract-header">
                    <p>
                        <strong>Contract Address:</strong> ${contractAddress}
                        <span class="toggle-icon">▼</span>
                    </p>
                    <p><strong>ETH Balance:</strong> ${ethers.formatEther(ethBalance)} ETH</p>
                </div>
                <div class="contract-details" style="display: none;">
                    ${tokensInfo.length > 0 ? `
                        <div class="tokens-header">
                            <p><strong>Tokens:</strong> <span class="toggle-icon">▼</span></p>
                        </div>
                        <div class="tokens-details" style="display: none;">
                            <ul>
                                ${tokensInfo.map(token => {
                                    const tokenEtherscanLink = `https://etherscan.io/token/${token.tokenAddress}`;
                                    return `
                                        <li>
                                            <a href="${tokenEtherscanLink}" target="_blank" class="token-link">
                                                ${token.name} (${token.symbol})
                                            </a>: ${token.balance} ${token.symbol}
                                        </li>
                                    `;
                                }).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    <!-- Beneficiaries List -->
                    <p><strong>Beneficiaries:</strong></p>
                    <ul>
                        ${beneficiaries.map((b) => {
                            const sharePercentage = Number(b.share) / 100; // Convert basis points to percentage
                            const etherscanLink = `https://etherscan.io/address/${b.beneficiaryAddress}`;
                            return `
                                <li>
                                    <a href="${etherscanLink}" target="_blank" class="address-link">
                                        ${b.beneficiaryAddress}
                                    </a> - ${sharePercentage.toFixed(2)}%
                                    <button class="remove-beneficiary-button" data-contract-address="${contractAddress}" data-beneficiary-address="${b.beneficiaryAddress}">✖</button>
                                </li>
                            `;
                        }).join('')}
                    </ul>

                    <!-- Nested Accordions -->
                    <div class="nested-accordion">
                        <!-- Assets Section -->
                        <div class="section-header">
                            <p>Manage Assets <span class="toggle-icon">▼</span></p>
                        </div>
                        <div class="section-content" style="display: none;">
                            <!-- Token Address Input -->
                            <div class="token-selection">
                                <label>Token Address:</label>
                                <input type="text" class="token-address-input" placeholder="Input token address (if left blank defaults to ETH)" style="width: 80%;">
                                <p class="token-info">Token: Ethereum (ETH)</p>
                            </div>
                            <!-- Deposit Form -->
                            <form class="deposit-form" data-contract-address="${contractAddress}">
                                <label>Deposit Amount:</label>
                                <div class="input-button-group">
                                    <input type="number" step="0.00000001" name="depositAmount" required>
                                    <button type="submit">Deposit</button>
                                </div>
                            </form>
                            <!-- Withdraw Form -->
                            <form class="withdraw-form" data-contract-address="${contractAddress}">
                                <label>Withdraw Amount:</label>
                                <div class="input-button-group">
                                    <input type="number" step="0.00000001" name="withdrawAmount" required>
                                    <button type="submit">Withdraw</button>
                                </div>
                            </form>
                        </div>

                        <!-- Beneficiaries Section -->
                        <div class="section-header">
                            <p>Add Beneficiaries <span class="toggle-icon">▼</span></p>
                        </div>
                        <div class="section-content" style="display: none;">
                            <form class="add-beneficiary-form" data-contract-address="${contractAddress}">
                                <label>Add Beneficiary:</label>
                                <div class="input-button-group">
                                    <input type="text" name="beneficiaryAddress" placeholder="Address" required>
                                    <input type="number" name="beneficiaryShare" placeholder="Share (%)" required>
                                    <button type="submit">Add</button>
                                </div>
                            </form>
                        </div>

                        <!-- Inactivity and Grace Period Section -->
                        <div class="section-header">
                            <p>Adjust Periods <span class="toggle-icon">▼</span></p>
                        </div>
                        <div class="section-content" style="display: none;">
                            <form class="update-inactivity-form" data-contract-address="${contractAddress}">
                                <label>Update Inactivity Period:</label>
                                <div class="input-button-group">
                                    <input type="number" name="inactivityPeriod" placeholder="Days" required>
                                    <button type="submit">Update</button>
                                </div>
                            </form>
                            <form class="update-grace-form" data-contract-address="${contractAddress}">
                                <label>Update Grace Period:</label>
                                <div class="input-button-group">
                                    <input type="number" name="gracePeriod" placeholder="Days" required>
                                    <button type="submit">Update</button>
                                </div>
                            </form>
                        </div>

                        <!-- Heartbeat Section -->
                        <div class="section-header">
                            <p>Heartbeat <span class="toggle-icon">▼</span></p>
                        </div>
                        <div class="section-content" style="display: none;">
                            <button class="heartbeat-button" data-contract-address="${contractAddress}">Call Heartbeat</button>
                        </div>
                    </div>

                    <!-- Distribute Inheritance Section -->
                    <div class="distribute-inheritance-section">
                        <p class="countdown-timer">Loading...</p>
                        <button class="distribute-button" disabled>Distribute Inheritance</button>
                    </div>
                    <p class="status-message"></p>
                </div>
            `;

            // **6. Append Contract Card to the List**
            contractsListDiv.appendChild(contractCard);

            // **7. Toggle Contract Details**
            const header = contractCard.querySelector('.contract-header');
            const details = contractCard.querySelector('.contract-details');
            const toggleIcon = header.querySelector('.toggle-icon');

            header.style.cursor = 'pointer';

            header.addEventListener('click', () => {
                if (details.style.display === 'none' || details.style.display === '') {
                    details.style.display = 'block';
                    toggleIcon.textContent = '▲'; // Change icon to up arrow
                } else {
                    details.style.display = 'none';
                    toggleIcon.textContent = '▼'; // Change icon to down arrow
                }
            });

            // **8. Tokens Toggle**
            if (tokensInfo.length > 0) {
                const tokensHeader = details.querySelector('.tokens-header');
                const tokensDetails = details.querySelector('.tokens-details');
                const tokensToggleIcon = tokensHeader.querySelector('.toggle-icon');

                tokensHeader.style.cursor = 'pointer';

                tokensHeader.addEventListener('click', () => {
                    if (tokensDetails.style.display === 'none' || tokensDetails.style.display === '') {
                        tokensDetails.style.display = 'block';
                        tokensToggleIcon.textContent = '▲';
                    } else {
                        tokensDetails.style.display = 'none';
                        tokensToggleIcon.textContent = '▼';
                    }
                });
            }

            // **9. Nested Accordion Event Listeners**
            const sectionHeaders = details.querySelectorAll('.section-header');
            sectionHeaders.forEach(sectionHeader => {
                const sectionContent = sectionHeader.nextElementSibling;
                const toggleIcon = sectionHeader.querySelector('.toggle-icon');

                sectionHeader.style.cursor = 'pointer';

                sectionHeader.addEventListener('click', () => {
                    if (sectionContent.style.display === 'none' || sectionContent.style.display === '') {
                        sectionContent.style.display = 'block';
                        toggleIcon.textContent = '▲';
                    } else {
                        sectionContent.style.display = 'none';
                        toggleIcon.textContent = '▼';
                    }
                });
            });

            // **10. Distribute Inheritance Section**
            const distributeSection = details.querySelector('.distribute-inheritance-section');
            const countdownTimer = distributeSection.querySelector('.countdown-timer');
            const distributeButton = distributeSection.querySelector('.distribute-button');
            const statusMessage = details.querySelector('.status-message');

            // **11. Initialize Countdown Timer**
            initializeCountdownTimer(targetTimestamp, countdownTimer, distributeButton, contractAddress, inheritanceContract, statusMessage);

            // **12. Event Listener for Distribute Inheritance Button**
            distributeButton.addEventListener('click', async () => {
                try {
                    distributeButton.disabled = true;
                    distributeButton.textContent = "Processing...";
                    const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                    const tx = await inheritanceContractSigner.distributeInheritance();
                    statusMessage.textContent = "Transaction Submitted. Waiting for confirmation...";
                    statusMessage.style.color = "blue";
                    await tx.wait();
                    statusMessage.textContent = "Inheritance Distributed Successfully!";
                    statusMessage.style.color = "green";
                    distributeButton.textContent = "Inheritance Distributed";
                    // Update the UI to reflect that inheritance has been distributed
                    countdownTimer.textContent = "Inheritance has been distributed.";
                } catch (error) {
                    console.error("Error distributing inheritance:", error);
                    statusMessage.textContent = `Error: ${error.reason || error.message}`;
                    statusMessage.style.color = "red";
                    distributeButton.disabled = false;
                    distributeButton.textContent = "Distribute Inheritance";
                }
            });

            // **13. Event Listeners for Forms and Buttons within Nested Accordions**
            // Deposit Form
            const depositForm = details.querySelector('.deposit-form');
            const depositButton = depositForm.querySelector('button[type="submit"]');
            const depositAmountInput = depositForm.elements['depositAmount'];
            const tokenAddressInput = details.querySelector('.token-address-input');
            const tokenInfoDisplay = details.querySelector('.token-info');

            // Update Deposit Button Text Based on Allowance
            const updateDepositButton = async () => {
                const tokenAddress = tokenAddressInput.value.trim();
                const depositAmount = depositAmountInput.value;
                if (tokenAddress === '') {
                    // ETH, no approval needed
                    depositButton.textContent = "Deposit";
                } else {
                    if (ethers.isAddress(tokenAddress)) {
                        try {
                            const { decimals } = await loadTokenDetails(tokenAddress);
                            const amount = parseFloat(depositAmount);
                            if (isNaN(amount) || amount <= 0) {
                                depositButton.textContent = "Deposit";
                                return;
                            }
                            const amountInUnits = ethers.parseUnits(depositAmount, decimals);
                            const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);
                            const allowance = await tokenContract.allowance(await signer.getAddress(), contractAddress);
                            if (allowance < amountInUnits) {
                                depositButton.textContent = "Approve";
                            } else {
                                depositButton.textContent = "Deposit";
                            }
                        } catch (error) {
                            depositButton.textContent = "Deposit";
                        }
                    } else {
                        depositButton.textContent = "Deposit";
                    }
                }
            };

            // Event Listeners to Update Deposit Button
            depositAmountInput.addEventListener('input', updateDepositButton);
            tokenAddressInput.addEventListener('input', updateDepositButton);

            // Token Address Input Event Listener
            tokenAddressInput.addEventListener('input', async () => {
                const tokenAddress = tokenAddressInput.value.trim();
                if (tokenAddress === '') {
                    // Default to ETH
                    tokenInfoDisplay.textContent = "Token: Ethereum (ETH)";
                } else {
                    if (ethers.isAddress(tokenAddress)) {
                        try {
                            const { name, symbol } = await loadTokenDetails(tokenAddress);
                            tokenInfoDisplay.textContent = `Token: ${name} (${symbol})`;
                        } catch (error) {
                            tokenInfoDisplay.textContent = "Invalid Token Address";
                        }
                    } else {
                        tokenInfoDisplay.textContent = "Invalid Token Address";
                    }
                }
                await updateDepositButton();
            });

            // Deposit Form Event Listener
            depositForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const depositAmount = depositForm.elements['depositAmount'].value;
                try {
                    const tokenAddress = tokenAddressInput.value.trim();
                    if (tokenAddress === '') {
                        // Handle ETH deposit
                        const tx = await signer.sendTransaction({
                            to: contractAddress,
                            value: ethers.parseEther(depositAmount)
                        });
                        statusMessage.textContent = "Deposit Transaction Submitted. Waiting for confirmation...";
                        statusMessage.style.color = "blue";
                        await tx.wait();
                        statusMessage.textContent = "ETH Deposited Successfully!";
                        statusMessage.style.color = "green";
                    } else {
                        // Handle ERC20
                        if (!ethers.isAddress(tokenAddress)) {
                            alert("Invalid token address.");
                            return;
                        }
                        // Load token details
                        const { symbol, decimals } = await loadTokenDetails(tokenAddress);
                        const amountInUnits = ethers.parseUnits(depositAmount, decimals);
                        const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                        const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, signer);

                        // Check the button text to decide the action
                        if (depositButton.textContent === "Approve") {
                            // Perform approval
                            const approveTx = await tokenContract.approve(contractAddress, ethers.MaxUint256);
                            statusMessage.textContent = "Approval Transaction Submitted. Waiting for confirmation...";
                            statusMessage.style.color = "blue";
                            await approveTx.wait();
                            statusMessage.textContent = "Token Approved Successfully!";
                            statusMessage.style.color = "green";
                            // After approval, update the button text and recheck allowance
                            depositButton.textContent = "Deposit";
                            await updateDepositButton();
                        } else if (depositButton.textContent === "Deposit") {
                            // Deposit tokens
                            const tx = await inheritanceContractSigner.depositERC20(tokenAddress, amountInUnits);
                            statusMessage.textContent = "Deposit Transaction Submitted. Waiting for confirmation...";
                            statusMessage.style.color = "blue";
                            await tx.wait();
                            statusMessage.textContent = `${symbol} Deposited Successfully!`;
                            statusMessage.style.color = "green";
                        }
                    }
                    // Refresh Contracts List
                    await displayUserContracts(factoryContractReadOnly, userAddress);
                    await displayBeneficiaryContracts(factoryContractReadOnly, userAddress);
                } catch (error) {
                    console.error("Error depositing assets:", error);
                    statusMessage.textContent = `Error: ${error.reason || error.message}`;
                    statusMessage.style.color = "red";
                }
            });

            // Withdraw Form
            const withdrawForm = details.querySelector('.withdraw-form');

            // Withdraw Form Event Listener
            withdrawForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const withdrawAmount = withdrawForm.elements['withdrawAmount'].value;
                try {
                    const tokenAddress = tokenAddressInput.value.trim();
                    if (tokenAddress === '') {
                        // Handle ETH withdrawal
                        const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                        const tx = await inheritanceContractSigner.withdrawEther(ethers.parseEther(withdrawAmount));
                        statusMessage.textContent = "Withdraw Transaction Submitted. Waiting for confirmation...";
                        statusMessage.style.color = "blue";
                        await tx.wait();
                        statusMessage.textContent = "ETH Withdrawn Successfully!";
                        statusMessage.style.color = "green";
                    } else {
                        // Handle ERC20 withdrawal
                        if (!ethers.isAddress(tokenAddress)) {
                            alert("Invalid token address.");
                            return;
                        }
                        // Load token details
                        const { symbol, decimals } = await loadTokenDetails(tokenAddress);
                        const amountInUnits = ethers.parseUnits(withdrawAmount, decimals);
                        const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                        const tx = await inheritanceContractSigner.withdrawERC20(tokenAddress, amountInUnits);
                        statusMessage.textContent = "Withdraw Transaction Submitted. Waiting for confirmation...";
                        statusMessage.style.color = "blue";
                        await tx.wait();
                        statusMessage.textContent = `${symbol} Withdrawn Successfully!`;
                        statusMessage.style.color = "green";
                    }
                    // Refresh Contracts List
                    await displayUserContracts(factoryContractReadOnly, userAddress);
                    await displayBeneficiaryContracts(factoryContractReadOnly, userAddress);
                } catch (error) {
                    console.error("Error withdrawing assets:", error);
                    statusMessage.textContent = `Error: ${error.reason || error.message}`;
                    statusMessage.style.color = "red";
                }
            });

            // Add Beneficiary Form
            const addBeneficiaryForm = details.querySelector('.add-beneficiary-form');

            // Add Beneficiary Form Event Listener
            addBeneficiaryForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const beneficiaryAddress = addBeneficiaryForm.elements['beneficiaryAddress'].value;
                const beneficiaryShare = addBeneficiaryForm.elements['beneficiaryShare'].value;
                const shareBps = Math.round(parseFloat(beneficiaryShare) * 100);
                try {
                    const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                    const tx = await inheritanceContractSigner.addBeneficiary(beneficiaryAddress, shareBps);
                    statusMessage.textContent = "Add Beneficiary Transaction Submitted. Waiting for confirmation...";
                    statusMessage.style.color = "blue";
                    await tx.wait();
                    statusMessage.textContent = "Beneficiary Added Successfully!";
                    statusMessage.style.color = "green";
                    // Refresh Contracts List
                    await displayUserContracts(factoryContractReadOnly, userAddress);
                    await displayBeneficiaryContracts(factoryContractReadOnly, userAddress);
                } catch (error) {
                    console.error("Error adding beneficiary:", error);
                    statusMessage.textContent = `Error: ${error.message}`;
                    statusMessage.style.color = "red";
                }
            });

            // Update Inactivity Period Form
            const updateInactivityForm = details.querySelector('.update-inactivity-form');

            // Update Inactivity Period Form Event Listener
            updateInactivityForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const inactivityPeriodDays = updateInactivityForm.elements['inactivityPeriod'].value;
                const inactivityPeriodSeconds = parseInt(inactivityPeriodDays) * 86400; // Convert days to seconds
                try {
                    const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                    const tx = await inheritanceContractSigner.updateInactivityPeriod(inactivityPeriodSeconds);
                    statusMessage.textContent = "Update Inactivity Period Transaction Submitted. Waiting for confirmation...";
                    statusMessage.style.color = "blue";
                    await tx.wait();
                    statusMessage.textContent = "Inactivity Period Updated Successfully!";
                    statusMessage.style.color = "green";
                    // Optionally, refresh the contract details
                } catch (error) {
                    console.error("Error updating inactivity period:", error);
                    statusMessage.textContent = `Error: ${error.message}`;
                    statusMessage.style.color = "red";
                }
            });

            // Update Grace Period Form
            const updateGraceForm = details.querySelector('.update-grace-form');

            // Update Grace Period Form Event Listener
            updateGraceForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const gracePeriodDays = updateGraceForm.elements['gracePeriod'].value;
                const gracePeriodSeconds = parseInt(gracePeriodDays) * 86400; // Convert days to seconds
                try {
                    const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                    const tx = await inheritanceContractSigner.updateGracePeriod(gracePeriodSeconds);
                    statusMessage.textContent = "Update Grace Period Transaction Submitted. Waiting for confirmation...";
                    statusMessage.style.color = "blue";
                    await tx.wait();
                    statusMessage.textContent = "Grace Period Updated Successfully!";
                    statusMessage.style.color = "green";
                    // Optionally, refresh the contract details
                } catch (error) {
                    console.error("Error updating grace period:", error);
                    statusMessage.textContent = `Error: ${error.message}`;
                    statusMessage.style.color = "red";
                }
            });

            // Heartbeat Button
            const heartbeatButton = details.querySelector('.heartbeat-button');

            // Heartbeat Button Event Listener
            heartbeatButton.addEventListener('click', async () => {
                try {
                    const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                    const tx = await inheritanceContractSigner.heartbeat();
                    statusMessage.textContent = "Heartbeat Transaction Submitted. Waiting for confirmation...";
                    statusMessage.style.color = "blue";
                    await tx.wait();
                    statusMessage.textContent = "Heartbeat Updated Successfully!";
                    statusMessage.style.color = "green";
                } catch (error) {
                    console.error("Error calling heartbeat:", error);
                    statusMessage.textContent = `Error: ${error.message}`;
                    statusMessage.style.color = "red";
                }
            });

            // Remove Beneficiary Buttons
            const removeButtons = details.querySelectorAll('.remove-beneficiary-button');

            // Remove Beneficiary Buttons Event Listener
            removeButtons.forEach(button => {
                button.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const beneficiaryAddress = button.getAttribute('data-beneficiary-address');
                    try {
                        const inheritanceContractSigner = new ethers.Contract(contractAddress, inheritanceABI, signer);
                        const tx = await inheritanceContractSigner.removeBeneficiary(beneficiaryAddress);
                        statusMessage.textContent = "Remove Beneficiary Transaction Submitted. Waiting for confirmation...";
                        statusMessage.style.color = "blue";
                        await tx.wait();
                        statusMessage.textContent = "Beneficiary Removed Successfully!";
                        statusMessage.style.color = "green";
                        // Refresh Contracts List
                        await displayUserContracts(factoryContractReadOnly, userAddress);
                        await displayBeneficiaryContracts(factoryContractReadOnly, userAddress);
                    } catch (error) {
                        console.error("Error removing beneficiary:", error);
                        statusMessage.textContent = `Error: ${error.message}`;
                        statusMessage.style.color = "red";
                    }
                });
            });

            // **14. Initialize Countdown Timer Function**
            // Assuming you have defined initializeCountdownTimer elsewhere
            // It handles the real-time countdown and enables the distribute button when ready
            initializeCountdownTimer(targetTimestamp, countdownTimer, distributeButton, contractAddress, inheritanceContract, statusMessage);
        }

    } catch (error) {
        console.error("Error displaying contracts:", error);
        contractsListDiv.innerHTML = "<p>Error fetching contracts.</p>";
    }
}

// DOM Elements
const createContractButton = document.getElementById('create-contract-button');
const shareWarning = document.getElementById('share-warning');


// DOM Elements for Create Contract
const addBeneficiaryButton = document.getElementById('add-beneficiary');
const beneficiariesContainer = document.getElementById('beneficiaries-container');


// Helper to Convert Time Units to Seconds
const convertToSeconds = (value, unit) => {
    switch (unit) {
        case 'minutes':
            return value * 60;
        case 'hours':
            return value * 3600;
        case 'days':
            return value * 86400;
        case 'years':
            return value * 31536000;
        default:
            return value; // Default is seconds
    }
};

// Event Listener for Beneficiary Share Inputs
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('beneficiary-share')) {
        validateTotalShares();
    }
});

// Add New Beneficiary Field
addBeneficiaryButton.addEventListener('click', () => {
    const beneficiaryGroup = document.createElement('div');
    beneficiaryGroup.className = 'beneficiary-group';
    beneficiaryGroup.innerHTML = `
        <input type="text" class="beneficiary-address" placeholder="Beneficiary Address (0x...)" required>
        <input type="number" class="beneficiary-share" placeholder="Share (%)" required>
    `;
    beneficiariesContainer.appendChild(beneficiaryGroup);

    // Add event listener to new share input
    beneficiaryGroup.querySelector('.beneficiary-share').addEventListener('input', validateTotalShares);
});


function validateTotalShares() {
    const beneficiaryShares = document.querySelectorAll('.beneficiary-share');
    let totalShares = 0;

    beneficiaryShares.forEach(input => {
        const shareValue = parseFloat(input.value) || 0;
        totalShares += shareValue;
    });

    // Round totalShares to avoid floating point precision issues
    totalShares = Math.round(totalShares * 1000000) / 1000000; // Round to 6 decimal places

    if (createContractButton && shareWarning) {
        const epsilon = 0.0001;
        if (Math.abs(totalShares - 100) < epsilon) {
            // Total shares are valid
            createContractButton.disabled = false;
            shareWarning.style.display = 'none';
            shareWarning.textContent = '';
        } else {
            // Total shares are invalid
            createContractButton.disabled = true;
            shareWarning.style.display = 'block';
            shareWarning.textContent = `Total shares must add up to 100%. Current total: ${totalShares.toFixed(2)}%`;
        }
    } else {
        console.warn("createContractButton or shareWarning element is missing.");
    }
}



// Create Inheritance Contract
createContractForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Collect Beneficiaries and Shares
    const beneficiaryAddresses = [];
    const beneficiaryShares = [];
    const beneficiaryGroups = document.querySelectorAll('.beneficiary-group');

    let hasIncompleteFields = false;
    let duplicateDetected = false;
    const addressSet = new Set();

    beneficiaryGroups.forEach(group => {
        const addressInput = group.querySelector('.beneficiary-address').value.trim();
        const shareInput = group.querySelector('.beneficiary-share').value.trim();

        const isAddressFilled = addressInput !== '';
        const isShareFilled = shareInput !== '';

        // Check if both fields are filled
        if (isAddressFilled || isShareFilled) {
            if (!isAddressFilled || !isShareFilled) {
                hasIncompleteFields = true;
                // Highlight the incomplete fields
                group.style.border = '1px solid red';
            } else if (ethers.isAddress(addressInput) && parseFloat(shareInput) > 0) {
                // Check for duplicate addresses
                if (addressSet.has(addressInput)) {
                    duplicateDetected = true;
                    group.style.border = '1px solid red';
                } else {
                    addressSet.add(addressInput);
                    beneficiaryAddresses.push(addressInput);
                    beneficiaryShares.push(Math.round(parseFloat(shareInput) * 100)); // Convert to basis points (10,000 bps = 100%)
                }
            } else {
                hasIncompleteFields = true;
                group.style.border = '1px solid red';
            }
        }
    });

    if (hasIncompleteFields) {
        createStatus.textContent = "Please complete all beneficiary fields or leave them entirely empty.";
        createStatus.style.color = "red";
        return;
    }

    if (duplicateDetected) {
        createStatus.textContent = "Duplicate beneficiary addresses detected.";
        createStatus.style.color = "red";
        return;
    }

    if (beneficiaryAddresses.length === 0) {
        createStatus.textContent = "At least one beneficiary must be provided.";
        createStatus.style.color = "red";
        return;
    }

    // Validate Shares Sum to be 100%
    const totalShares = beneficiaryShares.reduce((a, b) => a + b, 0);
    if (totalShares !== 10000) { // Ensure total shares equal 10,000 basis points
        createStatus.textContent = "Total shares must sum up to 100% (10,000 basis points)";
        createStatus.style.color = "red";
        return;
    }

    // Get Inactivity Period and Grace Period in Seconds
    const inactivityPeriodValue = parseInt(document.getElementById('inactivity-period').value);
    const inactivityPeriodUnit = document.getElementById('inactivity-period-unit').value;
    const gracePeriodValue = parseInt(document.getElementById('grace-period').value);
    const gracePeriodUnit = document.getElementById('grace-period-unit').value;

    const inactivityPeriodSeconds = convertToSeconds(inactivityPeriodValue, inactivityPeriodUnit);
    const gracePeriodSeconds = convertToSeconds(gracePeriodValue, gracePeriodUnit);

    // Get ETH Deposit
    const ethDeposit = document.getElementById('eth-deposit').value;

    // Additional Validation
    if (isNaN(inactivityPeriodSeconds) || isNaN(gracePeriodSeconds)) {
        createStatus.textContent = "Invalid period values.";
        createStatus.style.color = "red";
        return;
    }

    if (isNaN(parseFloat(ethDeposit)) || parseFloat(ethDeposit) < 0) {
        createStatus.textContent = "Invalid ETH deposit amount.";
        createStatus.style.color = "red";
        return;
    }

    const userAddress = await signer.getAddress();

    // Deploy Contract
    try {
        const tx = await factoryContract.createInheritanceContract(
            userAddress,
            beneficiaryAddresses,
            beneficiaryShares,
            inactivityPeriodSeconds,
            gracePeriodSeconds,
            { 
                value: ethers.parseEther(ethDeposit),
            }
        );

        createStatus.textContent = "Transaction Submitted. Waiting for confirmation...";
        createStatus.style.color = "blue";

        await tx.wait();
        createStatus.textContent = "Inheritance Contract Created Successfully!";
        createStatus.style.color = "green";

        // Refresh Contracts List
        const connectedAddress = await signer.getAddress();
        await displayUserContracts(factoryContractReadOnly, userAddress);
        await displayBeneficiaryContracts(factoryContractReadOnly, userAddress);

        // Reset Form
        createContractForm.reset();

        // Remove all beneficiary groups except the first one
        beneficiariesContainer.innerHTML = '';
        addBeneficiaryButton.click(); // Add an initial beneficiary field

    } catch (error) {
        console.error("Error creating contract:", error);
        createStatus.textContent = `Error: ${error.message}`;
        createStatus.style.color = "red";
    }
});
