// app_v2.js


(function () {
    // ===================== Configuration =====================

    // Network Configuration
    const networkConfigV2 = {
        '1': { // Ethereum Mainnet
            chainId: '0x1',
            chainName: 'Ethereum Mainnet',
            inheritanceManagerAddress: '0x861ca0324a485aB3F920AbE3c23e29e0B6652f51',
            rpcUrls: ['https://eth.llamarpc.com'], 
            icon: 'images/ethereum-icon.png',
            etherscanBaseUrl: 'https://etherscan.io',
        },
        '8453': { // Base Mainnet
            chainId: '0x2105', // 8453 in hex
            chainName: 'Base Mainnet',
            inheritanceManagerAddress: '0x1e1b366bc794f270f4a1d0f08159ca50619d2b43',
            rpcUrls: ['https://mainnet.base.org'], 
            icon: 'images/base-icon.png',
            etherscanBaseUrl: 'https://basescan.org',
        },
        '11155111': { // Sepolia Testnet
            chainId: '0xaa36a7',
            chainName: 'Sepolia Testnet',
            inheritanceManagerAddress: '0xcA0CcB5D6070d7102B733385811E6768C027f11E',
            rpcUrls: ['https://rpc.sepolia.org'],
            icon: 'images/sepolia-icon.png',
            etherscanBaseUrl: 'https://sepolia.etherscan.io',
        },
    };

    // Contract ABIs
    let inheritanceManagerABIV2;
    let erc20ABIV2;
    let inheritanceManagerContractReadOnlyV2;
    let currentNetworkConfigV2;

    // Load ABIs Asynchronously
    const loadABIsV2 = async () => {
        try {
            // Fetch ABI JSON file for the InheritanceManager
            const managerResponse = await fetch('contracts/InheritanceManager.json'); // Ensure the ABI file is updated
            inheritanceManagerABIV2 = await managerResponse.json();

            // Fetch ERC20 ABI
            const erc20Response = await fetch('contracts/erc20ABIV2.json'); // Use a different filename to avoid conflicts
            erc20ABIV2 = await erc20Response.json();

            console.log("V2 ABIs loaded successfully.", inheritanceManagerABIV2, erc20ABIV2);

            // Enable Connect Wallet button after ABIs are loaded
            document.getElementById('connect-wallet-v2').disabled = false;
        } catch (error) {
            console.error("Error loading V2 ABIs:", error);
            alert("Failed to load V2 contract ABIs. Please check the console for details.");
        }
    };

    // Global Variables
    let providerV2;
    let signerV2;
    let inheritanceManagerContractV2;

    let isConnectedV2 = false;

    // DOM Elements
    const connectWalletButtonV2 = document.getElementById('connect-wallet-v2');
    const walletAddressDisplayV2 = document.getElementById('wallet-address-v2');
    const networkIconV2 = document.getElementById('network-icon-v2');
    const networkSelectorV2 = document.getElementById('network-selector-v2');

    const createPlanFormV2 = document.getElementById('create-plan-form-v2');
    const createStatusV2 = document.getElementById('create-status-v2');

    const plansListDivV2 = document.getElementById('plans-list-v2');
    const beneficiaryPlansListDivV2 = document.getElementById('beneficiary-plans-list-v2');

        // ===================== Countdown Timers =====================
        const countdownTimersV2 = [];

        /**
         * Initializes a countdown timer for inheritance distribution.
         * @param {number} targetTimestamp - The UNIX timestamp when distribution is allowed.
         * @param {HTMLElement} countdownElement - The DOM element to display the countdown.
         * @param {HTMLElement} buttonElement - The button to enable/disable based on countdown.
         * @param {object} inheritanceManagerContract - The contract instance.
         * @param {string} ownerAddress - The address of the plan owner.
         * @param {HTMLElement} statusMessage - The DOM element to display status messages.
         */
        function initializeCountdownTimerV2(targetTimestamp, countdownElement, buttonElement, inheritanceManagerContract, ownerAddress, statusMessage) {
            const updateCountdown = async () => {
                const currentTime = Math.floor(Date.now() / 1000);
                let remainingTime = targetTimestamp - currentTime;
    
                if (remainingTime <= 0) {
                    countdownElement.textContent = "You can distribute the inheritance now.";
                    buttonElement.disabled = false;
                    buttonElement.textContent = "Distribute Inheritance";
                    // Remove this timer from the list as it's no longer needed
                    const index = countdownTimersV2.findIndex(timer => timer.update === updateCountdown);
                    if (index !== -1) {
                        countdownTimersV2.splice(index, 1);
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
            countdownTimersV2.push({ update: updateCountdown });
    
            // Initial call to set the countdown immediately
            updateCountdown();
        }
    
        // Initialize Countdown Timers for V2
        setInterval(() => {
            countdownTimersV2.forEach(timer => timer.update());
        }, 1000);

    // Function to initialize V2 functionalities
    function initializeV2() {
        // Disable Connect Wallet button until ABIs are loaded
        connectWalletButtonV2.disabled = true;

        // Load ABIs
        loadABIsV2();

        // Event Listener for Network Selector Dropdown Items
        const dropdownItemsV2 = networkSelectorV2.querySelectorAll('.dropdown-content a');

        dropdownItemsV2.forEach(item => {
            item.addEventListener('click', async (event) => {
                event.preventDefault();
                const targetChainId = event.currentTarget.getAttribute('data-network');
                await switchNetworkV2(targetChainId);
            });
        });

        // Connect Wallet
        connectWalletButtonV2.addEventListener('click', async () => {
            if (!isConnectedV2) {
                // Connect Wallet
                if (window.ethereum) {
                    try {
                        // Request account access
                        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                        const account = accounts[0];
                        walletAddressDisplayV2.textContent = `Connected: ${account}`;

                        // Initialize Ethers provider and signer
                        providerV2 = new ethers.BrowserProvider(window.ethereum);
                        signerV2 = await providerV2.getSigner();

                        // Get Network
                        const network = await providerV2.getNetwork();
                        const chainId = network.chainId.toString();

                        console.log('Connected Chain ID:', chainId);

                        // Set currentNetworkConfigV2 based on the chainId
                        currentNetworkConfigV2 = networkConfigV2[chainId];

                        if (!currentNetworkConfigV2) {
                            alert('Unsupported network.');
                            // Reset network icon
                            networkIconV2.src = 'images/default-icon.png';
                            return;
                        }

                        // Update network icon
                        networkIconV2.src = currentNetworkConfigV2.icon;

                        // Initialize InheritanceManager Contract
                        inheritanceManagerContractReadOnlyV2 = new ethers.Contract(currentNetworkConfigV2.inheritanceManagerAddress, inheritanceManagerABIV2, providerV2);
                        inheritanceManagerContractV2 = new ethers.Contract(currentNetworkConfigV2.inheritanceManagerAddress, inheritanceManagerABIV2, signerV2);

                        // Update UI: Change button text to "Disconnect Wallet"
                        connectWalletButtonV2.textContent = "Disconnect Wallet";

                        // Display User's Plans
                        await displayUserPlansV2(inheritanceManagerContractReadOnlyV2, account);

                        // Display Plans Where User is a Beneficiary
                        await displayBeneficiaryPlansV2(inheritanceManagerContractReadOnlyV2, account);

                        // Set connection state
                        isConnectedV2 = true;

                        // Listen for account changes
                        if (window.ethereum && window.ethereum.on) {
                            window.ethereum.on('accountsChanged', handleAccountsChangedV2);
                            window.ethereum.on('chainChanged', handleChainChangedV2);
                        }

                    } catch (error) {
                        console.error("Error connecting wallet:", error);
                        walletAddressDisplayV2.textContent = "Connection Failed";
                    }
                } else {
                    alert("Please install MetaMask!");
                }
            } else {
                // Disconnect Wallet
                try {
                    // Reset the UI
                    walletAddressDisplayV2.textContent = "Not connected";
                    connectWalletButtonV2.textContent = "Connect Wallet";
                    networkIconV2.src = 'images/default-icon.png';

                    // Reset state variables
                    providerV2 = null;
                    signerV2 = null;
                    inheritanceManagerContractReadOnlyV2 = null;
                    inheritanceManagerContractV2 = null;

                    // Remove event listeners
                    if (window.ethereum && window.ethereum.removeListener) {
                        window.ethereum.removeListener('accountsChanged', handleAccountsChangedV2);
                        window.ethereum.removeListener('chainChanged', handleChainChangedV2);
                    }

                    // Clear plans lists
                    plansListDivV2.innerHTML = "";
                    beneficiaryPlansListDivV2.innerHTML = "";

                    // Update connection state
                    isConnectedV2 = false;

                } catch (error) {
                    console.error("Error disconnecting wallet:", error);
                    alert("Failed to disconnect wallet.");
                }
            }
        });

        // Event Listener for Beneficiary Share Inputs
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('beneficiary-share-v2')) {
                validateTotalSharesV2();
            }
        });

        // Add New Beneficiary Field
        const addBeneficiaryButtonV2 = document.getElementById('add-beneficiary-v2');
        const beneficiariesContainerV2 = document.getElementById('beneficiaries-container-v2');

        addBeneficiaryButtonV2.addEventListener('click', () => {
            const beneficiaryGroup = document.createElement('div');
            beneficiaryGroup.className = 'beneficiary-group-v2';
            beneficiaryGroup.innerHTML = `
                <input type="text" class="beneficiary-address-v2" placeholder="Beneficiary Address (0x...)" required>
                <input type="number" class="beneficiary-share-v2" placeholder="Share (%)" required>
            `;
            beneficiariesContainerV2.appendChild(beneficiaryGroup);

            // Add event listener to new share input
            beneficiaryGroup.querySelector('.beneficiary-share-v2').addEventListener('input', validateTotalSharesV2);
        });

        // Create Inheritance Plan
        createPlanFormV2.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Collect Beneficiaries and Shares
            const beneficiaryAddresses = [];
            const beneficiaryShares = [];
            const beneficiaryGroups = document.querySelectorAll('.beneficiary-group-v2');

            let hasIncompleteFields = false;
            let duplicateDetected = false;
            const addressSet = new Set();

            beneficiaryGroups.forEach(group => {
                const addressInput = group.querySelector('.beneficiary-address-v2').value.trim();
                const shareInput = group.querySelector('.beneficiary-share-v2').value.trim();

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
                createStatusV2.textContent = "Please complete all beneficiary fields or leave them entirely empty.";
                createStatusV2.style.color = "red";
                return;
            }

            if (duplicateDetected) {
                createStatusV2.textContent = "Duplicate beneficiary addresses detected.";
                createStatusV2.style.color = "red";
                return;
            }

            if (beneficiaryAddresses.length === 0) {
                createStatusV2.textContent = "At least one beneficiary must be provided.";
                createStatusV2.style.color = "red";
                return;
            }

            // Validate Shares Sum to be 100%
            const totalShares = beneficiaryShares.reduce((a, b) => a + b, 0);
            if (totalShares !== 10000) { // Ensure total shares equal 10,000 basis points
                createStatusV2.textContent = "Total shares must sum up to 100% (10,000 basis points)";
                createStatusV2.style.color = "red";
                return;
            }

            // Get Inactivity Period and Grace Period in Seconds
            const inactivityPeriodValue = parseInt(document.getElementById('inactivity-period-v2').value);
            const inactivityPeriodUnit = document.getElementById('inactivity-period-unit-v2').value;
            const gracePeriodValue = parseInt(document.getElementById('grace-period-v2').value);
            const gracePeriodUnit = document.getElementById('grace-period-unit-v2').value;

            const inactivityPeriodSeconds = convertToSecondsV2(inactivityPeriodValue, inactivityPeriodUnit);
            const gracePeriodSeconds = convertToSecondsV2(gracePeriodValue, gracePeriodUnit);

            // Additional Validation
            if (isNaN(inactivityPeriodSeconds) || isNaN(gracePeriodSeconds)) {
                createStatusV2.textContent = "Invalid period values.";
                createStatusV2.style.color = "red";
                return;
            }

            const userAddress = await signerV2.getAddress();

            // Create Inheritance Plan
            try {
                const tx = await inheritanceManagerContractV2.createPlan(
                    beneficiaryAddresses,
                    beneficiaryShares,
                    inactivityPeriodSeconds,
                    gracePeriodSeconds
                );

                createStatusV2.textContent = "Transaction Submitted. Waiting for confirmation...";
                createStatusV2.style.color = "blue";

                await tx.wait();
                createStatusV2.textContent = "Inheritance Plan Created Successfully!";
                createStatusV2.style.color = "green";

                // Refresh Plans List
                await displayUserPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);
                await displayBeneficiaryPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);

                // Reset Form
                createPlanFormV2.reset();

                // Remove all beneficiary groups except the first one
                beneficiariesContainerV2.innerHTML = '';
                addBeneficiaryButtonV2.click(); // Add an initial beneficiary field

            } catch (error) {
                console.error("Error creating inheritance plan:", error);
                createStatusV2.textContent = `Error: ${error.message}`;
                createStatusV2.style.color = "red";
            }
        });

        // Initialize toggle behavior for V2
        initializeTogglesV2();
    }

    // Function to switch network
    async function switchNetworkV2(targetChainId) {
        try {
            const networkParams = networkConfigV2[targetChainId];
            if (!networkParams) {
                alert('Unsupported network.');
                return;
            }

            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: networkParams.chainId }],
            });
            // On success, handleChainChangedV2 will be triggered
        } catch (switchError) {
            if (switchError.code === 4902) {
                // The chain has not been added to MetaMask
                try {
                    const networkParams = networkConfigV2[targetChainId];
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: networkParams.chainId,
                            chainName: networkParams.chainName,
                            rpcUrls: networkParams.rpcUrls,
                            // Optional: add other parameters such as nativeCurrency, blockExplorerUrls
                        }],
                    });
                } catch (addError) {
                    console.error('Failed to add network:', addError);
                }
            } else {
                console.error('Failed to switch network:', switchError);
            }
        }
    }

    // Handle account changes
    function handleAccountsChangedV2(accounts) {
        if (accounts.length === 0) {
            walletAddressDisplayV2.textContent = "Not connected";
            connectWalletButtonV2.textContent = "Connect Wallet";
            isConnectedV2 = false;
            // Clear plans lists
            plansListDivV2.innerHTML = "<p>Not connected.</p>";
            beneficiaryPlansListDivV2.innerHTML = "<p>Not connected.</p>";
        } else {
            walletAddressDisplayV2.textContent = `Connected: ${accounts[0]}`;
            // Refresh the UI using the global inheritanceManagerContractReadOnlyV2
            displayUserPlansV2(inheritanceManagerContractReadOnlyV2, accounts[0]);
            displayBeneficiaryPlansV2(inheritanceManagerContractReadOnlyV2, accounts[0]);
        }
    }

    // Handle network changes
    async function handleChainChangedV2(_chainId) {
        const chainId = parseInt(_chainId, 16).toString(); // Convert hex chainId to decimal string

        console.log('Chain Changed to ID:', chainId);

        // Set currentNetworkConfigV2 based on the chainId
        currentNetworkConfigV2 = networkConfigV2[chainId];

        if (!currentNetworkConfigV2) {
            alert('Unsupported network.');
            // Reset network icon
            networkIconV2.src = 'images/default-icon.png';
            // Clear plans lists
            plansListDivV2.innerHTML = "<p>Unsupported network.</p>";
            beneficiaryPlansListDivV2.innerHTML = "<p>Unsupported network.</p>";
            return;
        }

        // Update network icon
        networkIconV2.src = currentNetworkConfigV2.icon;

        // Re-initialize provider and signer
        providerV2 = new ethers.BrowserProvider(window.ethereum);
        signerV2 = await providerV2.getSigner();

        // Re-initialize InheritanceManager Contract
        inheritanceManagerContractReadOnlyV2 = new ethers.Contract(currentNetworkConfigV2.inheritanceManagerAddress, inheritanceManagerABIV2, providerV2);
        inheritanceManagerContractV2 = new ethers.Contract(currentNetworkConfigV2.inheritanceManagerAddress, inheritanceManagerABIV2, signerV2);

        // Refresh UI
        const accounts = await providerV2.send('eth_accounts', []);
        const account = accounts[0];

        if (account) {
            walletAddressDisplayV2.textContent = `Connected: ${account}`;
            // Display User's Plans
            await displayUserPlansV2(inheritanceManagerContractReadOnlyV2, account);
            // Display Plans Where User is a Beneficiary
            await displayBeneficiaryPlansV2(inheritanceManagerContractReadOnlyV2, account);
        } else {
            // If no accounts are connected, update UI accordingly
            walletAddressDisplayV2.textContent = "Not connected";
            connectWalletButtonV2.textContent = "Connect Wallet";
            isConnectedV2 = false;
        }
    }

    // Initialize Connect Wallet Functionality
    initializeV2();

    // ===================== Toggle Behavior =====================

    function initializeTogglesV2() {
        // Select all headers with the class 'toggle-header' inside V2 content
        const toggleHeaders = document.querySelectorAll('#v2-tab .toggle-header');

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

    // ===================== Utility Functions =====================

    /**
     * Converts time units to seconds.
     * @param {number} value 
     * @param {string} unit 
     * @returns {number} Seconds
     */
    function convertToSecondsV2(value, unit) {
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
                return value;
        }
    }

    /**
     * Validates that total shares add up to 100%.
     */
    function validateTotalSharesV2() {
        const beneficiaryShares = document.querySelectorAll('.beneficiary-share-v2');
        let totalShares = 0;

        beneficiaryShares.forEach(input => {
            const shareValue = parseFloat(input.value) || 0;
            totalShares += shareValue;
        });

        // Round totalShares to avoid floating point precision issues
        totalShares = Math.round(totalShares * 1000000) / 1000000; // Round to 6 decimal places

        const createPlanButton = document.getElementById('create-plan-button-v2');
        const shareWarning = document.getElementById('share-warning-v2');

        if (createPlanButton && shareWarning) {
            const epsilon = 0.0001;
            if (Math.abs(totalShares - 100) < epsilon) {
                // Total shares are valid
                createPlanButton.disabled = false;
                shareWarning.style.display = 'none';
                shareWarning.textContent = '';
            } else {
                // Total shares are invalid
                createPlanButton.disabled = true;
                shareWarning.style.display = 'block';
                shareWarning.textContent = `Total shares must add up to 100%. Current total: ${totalShares.toFixed(2)}%`;
            }
        } else {
            console.warn("createPlanButtonV2 or shareWarningV2 element is missing.");
        }
    }

        // ===================== Display User's Plans =====================
    
/**
 * Displays the inheritance plans created by the user.
 * @param {object} managerContract - The read-only contract instance.
 * @param {string} userAddress - The address of the connected user.
 */
async function displayUserPlansV2(managerContract, userAddress) {
    if (!managerContract) return;

    plansListDivV2.innerHTML = "<p>Loading your inheritance plan...</p>";

    try {
        // Fetch the inheritance plan
        const plan = await managerContract.plans(userAddress);

        // Check if the plan exists by verifying the owner field
        if (plan.owner.toLowerCase() !== userAddress.toLowerCase()) {
            plansListDivV2.innerHTML = "<p>You have not created an inheritance plan yet.</p>";
            return;
        }

        if (plan.distributed) {
            plansListDivV2.innerHTML = "<p>Your inheritance plan has already been distributed.</p>";
            return;
        }

        // Fetch Beneficiaries using the getter function
        const beneficiaries = await managerContract.getBeneficiaries(userAddress);

        // Fetch approved tokens
        const approvedTokens = await managerContract.getTokens(userAddress);

        // Convert BigInt to Number
        const lastActive = Number(plan.lastActive);
        const inactivityPeriod = Number(plan.inactPeriod);
        const gracePeriod = Number(plan.gracePeriod);

        // Calculate target timestamp
        const targetTimestamp = lastActive + inactivityPeriod;

        // Create Plan Card
        const planCard = document.createElement('div');
        planCard.className = 'contract-card';
        planCard.innerHTML = `
            <div class="contract-header">
                <p>
                    <strong>Plan Owner:</strong> ${userAddress}
                    <span class="toggle-icon">▼</span>
                </p>
            </div>
            <div class="contract-details" style="display: none;">
                <!-- Beneficiaries List -->
                <p><strong>Beneficiaries:</strong></p>
                <ul>
                    ${beneficiaries.map((b) => {
                        const sharePercentage = Number(b.share) / 100; // Convert basis points to percentage
                        const etherscanLink = `${currentNetworkConfigV2.etherscanBaseUrl}/address/${b.addr}`;
                        return `
                            <li>
                                <a href="${etherscanLink}" target="_blank" class="address-link">
                                    ${b.addr}
                                </a> - ${sharePercentage.toFixed(2)}%
                                <button class="remove-beneficiary-button-v2" data-beneficiary-address="${b.addr}">✖</button>
                            </li>
                        `;
                    }).join('')}
                </ul>

                <!-- Nested Accordions -->
                <div class="nested-accordion">
                    <!-- Beneficiaries Section -->
                    <div class="section-header">
                        <p>Add Beneficiaries <span class="toggle-icon">▼</span></p>
                    </div>
                    <div class="section-content" style="display: none;">
                        <form class="add-beneficiary-form-v2">
                            <label>Add Beneficiary:</label>
                            <div class="input-button-group">
                                <input type="text" name="beneficiaryAddress" placeholder="Address (0x...)" required>
                                <input type="number" name="beneficiaryShare" placeholder="Share (%)" required min="0" step="any">
                                <button type="submit">Add</button>
                            </div>
                        </form>
                    </div>

                    <!-- Inactivity and Grace Period Section -->
                    <div class="section-header">
                        <p>Adjust Periods <span class="toggle-icon">▼</span></p>
                    </div>
                    <div class="section-content" style="display: none;">
                        <form class="update-inactivity-form-v2">
                            <label>Update Inactivity Period:</label>
                            <div class="input-button-group">
                                <input type="number" name="inactivityPeriod" placeholder="Days" required min="0" step="0.01">
                                <button type="submit">Update</button>
                            </div>
                        </form>
                        <form class="update-grace-form-v2">
                            <label>Update Grace Period:</label>
                            <div class="input-button-group">
                                <input type="number" name="gracePeriod" placeholder="Days" required min="0" step="1">
                                <button type="submit">Update</button>
                            </div>
                        </form>
                    </div>

                    <!-- Heartbeat Section -->
                    <div class="section-header">
                        <p>Heartbeat <span class="toggle-icon">▼</span></p>
                    </div>
                    <div class="section-content" style="display: none;">
                        <button class="heartbeat-button-v2">Call Heartbeat</button>
                    </div>
                </div>

                <!-- Distribute Inheritance Section -->
                <div class="distribute-inheritance-section-v2">
                    <p class="countdown-timer-v2">Loading...</p>
                    <button class="distribute-button-v2" disabled>Distribute Inheritance</button>
                    <p class="status-message-v2"></p>
                </div>

                <!-- Manage Tokens Section -->
                <div class="manage-tokens-section-v2">
                    <h3>Manage Tokens</h3>
                    <form class="manage-tokens-form-v2">
                        <input type="text" class="token-address-input-v2" placeholder="Token Address (0x...)" required>
                        <input type="number" class="token-amount-input-v2" placeholder="Amount to Approve" required min="0" step="any">
                        <button type="submit" class="approve-register-button-v2" disabled>Approve</button>
                    </form>
                    <p class="token-status-message-v2"></p>
                    <ul class="registered-tokens-list-v2"></ul>
                </div>

                <!-- Delete Inheritance Plan Section -->
                <div class="delete-plan-section-v2" style="margin-top: 20px;">
                    <button class="delete-plan-button-v2" style="background-color: red; color: white;">Delete Inheritance Plan</button>
                </div>
            </div>
        `;

        // Append plan card to the list
        plansListDivV2.innerHTML = '';
        plansListDivV2.appendChild(planCard);

        // Toggle plan details
        const header = planCard.querySelector('.contract-header');
        const details = planCard.querySelector('.contract-details');
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

        // Nested Accordion Event Listeners
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

        // Distribute Inheritance Section Elements
        const distributeSection = details.querySelector('.distribute-inheritance-section-v2');
        const countdownTimer = distributeSection.querySelector('.countdown-timer-v2');
        const distributeButton = distributeSection.querySelector('.distribute-button-v2');
        const statusMessage = distributeSection.querySelector('.status-message-v2');

        // Select the Adjust Period forms and Heartbeat button
        const updateInactivityForm = details.querySelector('.update-inactivity-form-v2');
        const updateGraceForm = details.querySelector('.update-grace-form-v2');

        // Initialize Countdown Timer
        initializeCountdownTimerV2(
            targetTimestamp, 
            countdownTimer, 
            distributeButton, 
            inheritanceManagerContractV2, 
            userAddress, 
            statusMessage
        );

        // Event Listener for Distribute Inheritance Button
        distributeButton.addEventListener('click', async () => {
            try {
                distributeButton.disabled = true;
                distributeButton.textContent = "Processing...";
                statusMessage.textContent = "Transaction Submitted. Waiting for confirmation...";
                statusMessage.style.color = "blue";

                const tx = await inheritanceManagerContractV2.distributeInheritance(userAddress);
                await tx.wait();

                statusMessage.textContent = "Inheritance Distributed Successfully!";
                statusMessage.style.color = "green";
                distributeButton.textContent = "Inheritance Distributed";

                // Update the UI to reflect that inheritance has been distributed.
                countdownTimer.textContent = "Inheritance has been distributed.";
            } catch (error) {
                console.error("Error distributing inheritance:", error);
                statusMessage.textContent = `Error: ${error.reason || error.message}`;
                statusMessage.style.color = "red";
                distributeButton.disabled = false;
                distributeButton.textContent = "Distribute Inheritance";
            }
        });

        // ===================== Adjust Period Forms =====================

        /**
         * Event listener for Update Inactivity Period form submission
         */
        updateInactivityForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent page refresh

            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime >= targetTimestamp) {
                statusMessage.textContent = "Cannot update periods after inactivity period has passed.";
                statusMessage.style.color = "red";
                return;
            }

            // Get the new inactivity period from the form
            const newInactivityPeriodValue = parseFloat(updateInactivityForm.elements['inactivityPeriod'].value);
            const newInactivityPeriodUnit = 'days'; // Adjust if you have a unit selector
            const newInactivityPeriodSeconds = convertToSecondsV2(newInactivityPeriodValue, newInactivityPeriodUnit);

            if (isNaN(newInactivityPeriodSeconds) || newInactivityPeriodSeconds <= 0) {
                statusMessage.textContent = "Invalid inactivity period.";
                statusMessage.style.color = "red";
                return;
            }

            try {
                // Call the smart contract function to update inactivity period
                const tx = await inheritanceManagerContractV2.updateInactPeriod(newInactivityPeriodSeconds);
                statusMessage.textContent = "Updating inactivity period... Waiting for confirmation...";
                statusMessage.style.color = "blue";

                await tx.wait(); // Wait for transaction confirmation

                statusMessage.textContent = "Inactivity period updated successfully!";
                statusMessage.style.color = "green";

                // Optionally, refresh the plan details
                await displayUserPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);
            } catch (error) {
                console.error("Error updating inactivity period:", error);
                statusMessage.textContent = `Error: ${error.reason || error.message}`;
                statusMessage.style.color = "red";
            }
        });

        /**
         * Event listener for Update Grace Period form submission
         */
        updateGraceForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent page refresh

            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime >= targetTimestamp) {
                statusMessage.textContent = "Cannot update periods after inactivity period has passed.";
                statusMessage.style.color = "red";
                return;
            }

            // Get the new grace period from the form
            const newGracePeriodValue = parseFloat(updateGraceForm.elements['gracePeriod'].value); // Changed to parseFloat if step is 0.01
            const newGracePeriodUnit = 'days'; // Adjust if you have a unit selector
            const newGracePeriodSeconds = convertToSecondsV2(newGracePeriodValue, newGracePeriodUnit);

            if (isNaN(newGracePeriodSeconds) || newGracePeriodSeconds <= 0) {
                statusMessage.textContent = "Invalid grace period.";
                statusMessage.style.color = "red";
                return;
            }

            try {
                // Call the smart contract function to update grace period
                const tx = await inheritanceManagerContractV2.updateGracePeriod(newGracePeriodSeconds);
                statusMessage.textContent = "Updating grace period... Waiting for confirmation...";
                statusMessage.style.color = "blue";

                await tx.wait(); // Wait for transaction confirmation

                statusMessage.textContent = "Grace period updated successfully!";
                statusMessage.style.color = "green";

                // Optionally, refresh the plan details
                await displayUserPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);
            } catch (error) {
                console.error("Error updating grace period:", error);
                statusMessage.textContent = `Error: ${error.reason || error.message}`;
                statusMessage.style.color = "red";
            }
        });

        // ===================== Heartbeat Button =====================

        const heartbeatButton = details.querySelector('.heartbeat-button-v2');

        /**
         * Event listener for Heartbeat button click
         */
        heartbeatButton.addEventListener('click', async () => {
            const currentTime = Math.floor(Date.now() / 1000);
            if (currentTime >= targetTimestamp) {
                statusMessage.textContent = "Cannot send heartbeat after inactivity period has passed.";
                statusMessage.style.color = "red";
                return;
            }

            // Optional: Confirm with the user before proceeding
            if (!confirm("Are you sure you want to send a heartbeat?")) {
                return;
            }

            try {
                // Call the smart contract heartbeat function
                const tx = await inheritanceManagerContractV2.heartbeat();
                statusMessage.textContent = "Sending heartbeat... Waiting for confirmation...";
                statusMessage.style.color = "blue";

                await tx.wait(); // Wait for transaction confirmation

                statusMessage.textContent = "Heartbeat sent successfully!";
                statusMessage.style.color = "green";

                // Optionally, refresh the plan details
                await displayUserPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);
            } catch (error) {
                console.error("Error sending heartbeat:", error);
                statusMessage.textContent = `Error: ${error.reason || error.message}`;
                statusMessage.style.color = "red";
            }
        });

        // ===================== Add Beneficiary Form =====================

        const addBeneficiaryForm = details.querySelector('.add-beneficiary-form-v2');
        addBeneficiaryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const beneficiaryAddress = addBeneficiaryForm.elements['beneficiaryAddress'].value.trim();
            const beneficiaryShare = addBeneficiaryForm.elements['beneficiaryShare'].value.trim();

            if (!isValidAddressV2(beneficiaryAddress)) {
                alert("Invalid beneficiary address.");
                return;
            }

            if (parseFloat(beneficiaryShare) <= 0) {
                alert("Share must be greater than 0.");
                return;
            }

            try {
                const shareBps = Math.round(parseFloat(beneficiaryShare) * 100); // Convert to basis points (0.01% steps)
                const tx = await inheritanceManagerContractV2.addBeneficiary(beneficiaryAddress, shareBps);
                statusMessage.textContent = "Add Beneficiary Transaction Submitted. Waiting for confirmation...";
                statusMessage.style.color = "blue";
                await tx.wait();
                statusMessage.textContent = "Beneficiary Added Successfully!";
                statusMessage.style.color = "green";

                // Refresh Plans List
                await displayUserPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);
                await displayBeneficiaryPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);

                // Reset Add Beneficiary Form
                addBeneficiaryForm.reset();
            } catch (error) {
                console.error("Error adding beneficiary:", error);
                statusMessage.textContent = `Error: ${error.reason || error.message}`;
                statusMessage.style.color = "red";
            }
        });

        // ===================== Remove Beneficiary Buttons =====================

        const removeButtons = details.querySelectorAll('.remove-beneficiary-button-v2');

        // Remove Beneficiary Buttons Event Listener
        removeButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const beneficiaryAddress = button.getAttribute('data-beneficiary-address');
                if (!beneficiaryAddress) return;

                if (!confirm(`Are you sure you want to remove beneficiary ${beneficiaryAddress}?`)) {
                    return;
                }

                try {
                    const tx = await inheritanceManagerContractV2.removeBeneficiary(beneficiaryAddress);
                    statusMessage.textContent = "Remove Beneficiary Transaction Submitted. Waiting for confirmation...";
                    statusMessage.style.color = "blue";
                    await tx.wait();
                    statusMessage.textContent = "Beneficiary Removed Successfully!";
                    statusMessage.style.color = "green";

                    // Refresh Plans List
                    await displayUserPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);
                    await displayBeneficiaryPlansV2(inheritanceManagerContractReadOnlyV2, userAddress);
                } catch (error) {
                    console.error("Error removing beneficiary:", error);
                    statusMessage.textContent = `Error: ${error.reason || error.message}`;
                    statusMessage.style.color = "red";
                }
            });
        });

         // ===================== Manage Tokens Section =====================
 
         // Select elements within the manageTokensSection
         const manageTokensForm = details.querySelector('.manage-tokens-form-v2');
         const tokenAddressInput = details.querySelector('.token-address-input-v2');
         const tokenAmountInput = details.querySelector('.token-amount-input-v2');
         const approveRegisterButton = details.querySelector('.approve-register-button-v2');
         const tokenStatusMessage = details.querySelector('.token-status-message-v2');
         const registeredTokensList = details.querySelector('.registered-tokens-list-v2');
 
         let currentToken = {
             address: '',
             name: '',
             symbol: '',
             decimals: 18, // default to 18, will fetch from token contract
             allowance: 0
         };
 
         // Function to fetch token details
         async function fetchTokenDetails(tokenAddress) {
             try {
                 const tokenContract = new ethers.Contract(tokenAddress, erc20ABIV2, providerV2);
                 const name = await tokenContract.name();
                 const symbol = await tokenContract.symbol();
                 const decimals = await tokenContract.decimals();
                 return { name, symbol, decimals };
             } catch (error) {
                 console.error("Error fetching token details:", error);
                 throw new Error("Invalid ERC20 token address or unable to fetch token details.");
             }
         }
 
         // Function to fetch current allowance
         async function fetchCurrentAllowance(tokenAddress, ownerAddress) {
             try {
                 const tokenContract = new ethers.Contract(tokenAddress, erc20ABIV2, providerV2);
                 const allowance = await tokenContract.allowance(ownerAddress, currentNetworkConfigV2.inheritanceManagerAddress);
                 return allowance;
             } catch (error) {
                 console.error("Error fetching allowance:", error);
                 throw new Error("Unable to fetch current allowance.");
             }
         }
 
         // Function to check and update the approve/register button state
         async function checkApproveButtonState() {
             if (!currentToken.address) {
                 approveRegisterButton.disabled = true;
                 approveRegisterButton.textContent = "Approve";
                 return;
             }
 
             try {
                 tokenStatusMessage.textContent = "Fetching current allowance...";
                 tokenStatusMessage.style.color = "blue";
                 const allowance = await fetchCurrentAllowance(currentToken.address, userAddress);
                 currentToken.allowance = parseFloat(ethers.formatUnits(allowance, currentToken.decimals));
                 tokenStatusMessage.textContent = `Current Allowance: ${currentToken.allowance} ${currentToken.symbol}`;
                 tokenStatusMessage.style.color = "green";
                 approveRegisterButton.disabled = false;
                 updateApproveRegisterButton();
             } catch (error) {
                 tokenStatusMessage.textContent = error.message;
                 tokenStatusMessage.style.color = "red";
                 approveRegisterButton.disabled = true;
             }
         }
 
         // Function to update the button label based on allowance and input amount
         function updateApproveRegisterButton() {
             const inputAmount = parseFloat(tokenAmountInput.value.trim());
             if (isNaN(inputAmount) || inputAmount <= 0) {
                 approveRegisterButton.disabled = true;
                 approveRegisterButton.textContent = "Approve";
                 return;
             }
 
             if (inputAmount <= currentToken.allowance) {
                 approveRegisterButton.textContent = "Register";
                 approveRegisterButton.disabled = false;
             } else {
                 approveRegisterButton.textContent = "Approve";
                 approveRegisterButton.disabled = false;
             }
         }
 
         // Event listener for token address input
         tokenAddressInput.addEventListener('blur', async () => {
             const address = tokenAddressInput.value.trim();
             if (ethers.isAddress(address)) {
                 try {
                     tokenStatusMessage.textContent = "Fetching token details...";
                     tokenStatusMessage.style.color = "blue";
                     const { name, symbol, decimals } = await fetchTokenDetails(address);
                     currentToken.address = address;
                     currentToken.name = name;
                     currentToken.symbol = symbol;
                     currentToken.decimals = decimals;
                     tokenStatusMessage.textContent = `Token: ${name} (${symbol}), Decimals: ${decimals}`;
                     tokenStatusMessage.style.color = "green";
                     await checkApproveButtonState();
                 } catch (error) {
                     tokenStatusMessage.textContent = error.message;
                     tokenStatusMessage.style.color = "red";
                     approveRegisterButton.disabled = true;
                     currentToken = {
                         address: '',
                         name: '',
                         symbol: '',
                         decimals: 18,
                         allowance: 0
                     };
                 }
             } else {
                 tokenStatusMessage.textContent = "Invalid Ethereum address.";
                 tokenStatusMessage.style.color = "red";
                 approveRegisterButton.disabled = true;
                 currentToken = {
                     address: '',
                     name: '',
                     symbol: '',
                     decimals: 18,
                     allowance: 0
                 };
             }
         });
 
         // Event listener for amount input
         tokenAmountInput.addEventListener('input', () => {
             updateApproveRegisterButton();
         });
 
         // Event listener for manageTokensForm submission
         manageTokensForm.addEventListener('submit', async (e) => {
             e.preventDefault();
 
             const tokenAddress = tokenAddressInput.value.trim();
             const amount = parseFloat(tokenAmountInput.value.trim());
 
             if (!ethers.isAddress(tokenAddress)) {
                 tokenStatusMessage.textContent = "Invalid token address.";
                 tokenStatusMessage.style.color = "red";
                 return;
             }
 
             if (isNaN(amount) || amount <= 0) {
                 tokenStatusMessage.textContent = "Invalid amount.";
                 tokenStatusMessage.style.color = "red";
                 return;
             }
 
             const humanReadableAmount = amount;
             const smallestUnitAmount = ethers.parseUnits(amount.toString(), currentToken.decimals);
 
             if (approveRegisterButton.textContent === "Approve") {
                 // Approve action
                 try {
                     approveRegisterButton.disabled = true;
                     approveRegisterButton.textContent = "Approving...";
                     tokenStatusMessage.textContent = "Submitting approval transaction...";
                     tokenStatusMessage.style.color = "blue";
 
                     const tokenContract = new ethers.Contract(tokenAddress, erc20ABIV2, signerV2);
                     const tx = await tokenContract.approve(currentNetworkConfigV2.inheritanceManagerAddress, smallestUnitAmount);
                     await tx.wait();
 
                     tokenStatusMessage.textContent = `Approved ${humanReadableAmount} ${currentToken.symbol} successfully.`;
                     tokenStatusMessage.style.color = "green";
 
                     // Update allowance
                     await checkApproveButtonState();
                 } catch (error) {
                     console.error("Error approving token:", error);
                     tokenStatusMessage.textContent = `Error approving token: ${error.message}`;
                     tokenStatusMessage.style.color = "red";
                     approveRegisterButton.disabled = false;
                 }
             } else if (approveRegisterButton.textContent === "Register") {
                 // Register action
                 try {
                     approveRegisterButton.disabled = true;
                     approveRegisterButton.textContent = "Registering...";
                     tokenStatusMessage.textContent = "Submitting registration transaction...";
                     tokenStatusMessage.style.color = "blue";
 
                     // Call registerToken on the InheritanceManager contract
                     const tx = await inheritanceManagerContractV2.registerToken(tokenAddress);
                     await tx.wait();
 
                     tokenStatusMessage.textContent = `Registered ${humanReadableAmount} ${currentToken.symbol} successfully.`;
                     tokenStatusMessage.style.color = "green";
 
                     // Refresh the registered tokens list
                     await fetchAndDisplayRegisteredTokens();
 
                     // Reset form
                     manageTokensForm.reset();
                     approveRegisterButton.disabled = true;
                     approveRegisterButton.textContent = "Approve";
                 } catch (error) {
                     console.error("Error registering token:", error);
                     tokenStatusMessage.textContent = `Error registering token: ${error.message}`;
                     tokenStatusMessage.style.color = "red";
                     approveRegisterButton.disabled = false;
                 }
             }
         });
 
         // Function to fetch and display registered tokens
         async function fetchAndDisplayRegisteredTokens() {
             try {
                 const registeredTokens = await inheritanceManagerContractReadOnlyV2.getTokens(userAddress);
                 // Assuming getTokens returns an array of token addresses
                 registeredTokensList.innerHTML = ''; // Clear existing list
 
                 if (registeredTokens.length === 0) {
                     registeredTokensList.innerHTML = '<li>No tokens registered.</li>';
                     return;
                 }
 
                 for (const tokenAddress of registeredTokens) {
                     try {
                         const tokenDetails = await fetchTokenDetails(tokenAddress);
                         const tokenContract = new ethers.Contract(tokenAddress, erc20ABIV2, providerV2);
                         const allowance = await tokenContract.allowance(userAddress, currentNetworkConfigV2.inheritanceManagerAddress);
                         const decimals = tokenDetails.decimals;
                         const humanReadableAllowance = parseFloat(ethers.formatUnits(allowance, decimals));
 
                         const listItem = document.createElement('li');
                         listItem.innerHTML = `
                         <span>Registered Tokens</span>
                         <br>
                             <span>${tokenDetails.name} (${tokenDetails.symbol}) - Allowance: ${humanReadableAllowance}</span>
                             <button class="unregister-token-button-v2" data-token-address="${tokenAddress}">Unregister</button>
                         `;
                         registeredTokensList.appendChild(listItem);
                     } catch (error) {
                         console.error(`Error fetching details for token ${tokenAddress}:`, error);
                     }
                 }
 
                 // Attach event listeners to Unregister buttons
                 const unregisterButtons = registeredTokensList.querySelectorAll('.unregister-token-button-v2');
                 unregisterButtons.forEach(button => {
                     button.addEventListener('click', async (e) => {
                         e.preventDefault();
                         const tokenAddress = button.getAttribute('data-token-address');
                         if (!tokenAddress) return;
 
                         if (!confirm(`Are you sure you want to unregister token ${tokenAddress}?`)) {
                             return;
                         }
 
                         try {
                             button.disabled = true;
                             button.textContent = "Unregistering...";
                             tokenStatusMessage.textContent = "Submitting unregistration transaction...";
                             tokenStatusMessage.style.color = "blue";
 
                             // Call revokeTokenApproval on the InheritanceManager contract
                             const tx = await inheritanceManagerContractV2.revokeTokenApproval(tokenAddress);
                             await tx.wait();
 
                             tokenStatusMessage.textContent = `Unregistered token ${tokenAddress} successfully.`;
                             tokenStatusMessage.style.color = "green";
 
                             // Refresh the registered tokens list
                             await fetchAndDisplayRegisteredTokens();
                         } catch (error) {
                             console.error("Error unregistering token:", error);
                             tokenStatusMessage.textContent = `Error unregistering token: ${error.message}`;
                             tokenStatusMessage.style.color = "red";
                             button.disabled = false;
                             button.textContent = "Unregister";
                         }
                     });
                 });
 
             } catch (error) {
                 console.error("Error fetching registered tokens:", error);
                 registeredTokensList.innerHTML = "<li>Error fetching registered tokens.</li>";
             }
         }
 
         // Fetch and display registered tokens initially
         await fetchAndDisplayRegisteredTokens();

        // ===================== Delete Inheritance Plan Button =====================

        // Select the Delete Plan button
        const deletePlanButton = details.querySelector('.delete-plan-button-v2');

        // Attach event listener to Delete Plan button
        deletePlanButton.addEventListener('click', async () => {
            // First Confirmation
            const isConfirmed = confirm("Are you sure you want to delete your inheritance plan?");
            if (!isConfirmed) return;

            // Second Confirmation: User must type 'delete'
            const userInput = prompt("Please type 'delete' in the box to confirm deletion of your inheritance plan.");
            if (userInput !== 'delete') {
                alert("Deletion cancelled. You did not type 'delete'.");
                return;
            }

            try {
                deletePlanButton.disabled = true;
                deletePlanButton.textContent = "Deleting...";
                statusMessage.textContent = "Deleting inheritance plan... Waiting for confirmation...";
                statusMessage.style.color = "blue";

                // Call the deletePlan function on the smart contract
                const tx = await inheritanceManagerContractV2.deletePlan();
                await tx.wait();

                statusMessage.textContent = "Inheritance plan deleted successfully!";
                statusMessage.style.color = "green";

                // Optionally, remove the plan card from the UI
                plansListDivV2.innerHTML = "<p>Your inheritance plan has been deleted.</p>";
            } catch (error) {
                console.error("Error deleting inheritance plan:", error);
                statusMessage.textContent = `Error: ${error.reason || error.message}`;
                statusMessage.style.color = "red";
                deletePlanButton.disabled = false;
                deletePlanButton.textContent = "Delete Inheritance Plan";
            }
        });

    } catch (error) {
        console.error("Error displaying your inheritance plan:", error);
        plansListDivV2.innerHTML = "<p>Error fetching your inheritance plan.</p>";
    }
}

 
    
        /**
 * Displays the inheritance plans where the user is a beneficiary.
 * @param {object} managerContract - The read-only contract instance.
 * @param {string} userAddress - The address of the connected user.
 */
async function displayBeneficiaryPlansV2(managerContract, userAddress) {
    if (!managerContract) return;

    beneficiaryPlansListDivV2.innerHTML = "<p>Loading plans where you are a beneficiary...</p>";

    try {
        // Fetch plans where the user is a beneficiary
        const beneficiaryPlans = await managerContract.getPlansByBeneficiary(userAddress);

        if (beneficiaryPlans.length === 0) {
            beneficiaryPlansListDivV2.innerHTML = "<p>No plans found where you are a beneficiary.</p>";
            return;
        }

        beneficiaryPlansListDivV2.innerHTML = ''; // Clear loading message

        for (const ownerAddress of beneficiaryPlans) {
            // Fetch the inheritance plan
            const plan = await managerContract.plans(ownerAddress);

            if (plan.distributed) {
                console.log(`Plan for ${ownerAddress} has already been distributed. Skipping display.`);
                continue; // Skip to the next plan
            }

            // Fetch Beneficiaries
            const beneficiaries = await managerContract.getBeneficiaries(ownerAddress);

            // Convert BigInt to Number
            const lastActive = Number(plan.lastActive);
            const inactivityPeriod = Number(plan.inactPeriod);
            const gracePeriod = Number(plan.gracePeriod);

            // Calculate target timestamp
            const targetTimestamp = lastActive + inactivityPeriod;

            // Create Plan Card
            const planCard = document.createElement('div');
            planCard.className = 'contract-card';
            planCard.innerHTML = `
                <div class="contract-header">
                    <p>
                        <strong>Plan Owner:</strong> ${ownerAddress}
                        <span class="toggle-icon">▼</span>
                    </p>
                </div>
                <div class="contract-details" style="display: none;">
                    <!-- Beneficiaries List -->
                    <p><strong>Beneficiaries:</strong></p>
                    <ul>
                        ${beneficiaries.map((b) => {
                            const sharePercentage = Number(b.share) / 100; // Convert basis points to percentage
                            const etherscanLink = `${currentNetworkConfigV2.etherscanBaseUrl}/address/${b.addr}`;
                            return `
                                <li>
                                    <a href="${etherscanLink}" target="_blank" class="address-link">
                                        ${b.addr}
                                    </a> - ${sharePercentage.toFixed(2)}%
                                </li>
                            `;
                        }).join('')}
                    </ul>

                    <!-- Distribute Inheritance Section -->
                    <div class="distribute-inheritance-section-v2">
                        <p class="countdown-timer-v2">Loading...</p>
                        <button class="distribute-button-v2" disabled>Distribute Inheritance</button>
                        <p class="status-message-v2"></p>
                    </div>
                </div>
            `;

            // Append plan card to the list
            beneficiaryPlansListDivV2.appendChild(planCard);

            // Toggle plan details
            const header = planCard.querySelector('.contract-header');
            const details = planCard.querySelector('.contract-details');
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

            // Distribute Inheritance Section Elements
            const distributeSection = details.querySelector('.distribute-inheritance-section-v2');
            const countdownTimer = distributeSection.querySelector('.countdown-timer-v2');
            const distributeButton = distributeSection.querySelector('.distribute-button-v2');
            const statusMessage = distributeSection.querySelector('.status-message-v2');

            // Initialize Countdown Timer
            initializeCountdownTimerV2(targetTimestamp, countdownTimer, distributeButton, inheritanceManagerContractV2, ownerAddress, statusMessage);

            // Event Listener for Distribute Inheritance Button
            distributeButton.addEventListener('click', async () => {
                try {
                    distributeButton.disabled = true;
                    distributeButton.textContent = "Processing...";
                    statusMessage.textContent = "Transaction Submitted. Waiting for confirmation...";
                    statusMessage.style.color = "blue";

                    const tx = await inheritanceManagerContractV2.distributeInheritance(ownerAddress);
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
        }

    } catch (error) {
        console.error("Error displaying beneficiary plans:", error);
        beneficiaryPlansListDivV2.innerHTML = "<p>Error fetching beneficiary plans.</p>";
    }
}

    
        // ===================== Initialize Toggles =====================
    
        function initializeTogglesV2() {
            // Select all headers with the class 'toggle-header' across the entire document
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
        

        // ===================== Utility Functions =====================
    
        /**
         * Checks if a given address is a valid Ethereum address.
         * @param {string} address 
         * @returns {boolean}
         */
        function isValidAddressV2(address) {
            try {
                ethers.getAddress(address);
                return true;
            } catch {
                return false;
            }
        }
    
    })();
