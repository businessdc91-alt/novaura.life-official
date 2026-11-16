import React, { useState, useCallback, useEffect } from 'react';
import {
  validateCoupon,
  applyCoupon,
  removeCoupon,
  formatCouponCode,
  formatDiscountDisplay,
  formatCurrency,
  getSuggestedCoupons,
  type CouponResult,
  type Cart,
} from '../../services/couponService';

interface CouponInputProps {
  onApply: (code: string, result: CouponResult) => void;
  onRemove: () => void;
  appliedCoupon?: CouponResult | null;
  subtotal: number;
}

type InputState = 'empty' | 'typing' | 'validating' | 'valid' | 'invalid' | 'applied';

export const CouponInput: React.FC<CouponInputProps> = ({
  onApply,
  onRemove,
  appliedCoupon,
  subtotal,
}) => {
  const [code, setCode] = useState('');
  const [inputState, setInputState] = useState<InputState>('empty');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationResult, setValidationResult] = useState<CouponResult | null>(null);

  // Sync with external appliedCoupon state
  useEffect(() => {
    if (appliedCoupon?.valid && appliedCoupon.coupon) {
      setInputState('applied');
      setCode(appliedCoupon.coupon.code);
      setValidationResult(appliedCoupon);
    } else {
      setInputState(code.trim() ? 'typing' : 'empty');
    }
  }, [appliedCoupon]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = formatCouponCode(e.target.value);
    setCode(value);
    setErrorMessage('');
    
    if (value.trim()) {
      setInputState('typing');
    } else {
      setInputState('empty');
    }
  };

  const handleApply = useCallback(async () => {
    if (!code.trim()) return;

    setInputState('validating');
    setErrorMessage('');

    const cart: Cart = {
      subtotal,
      items: [], // Cart items would be passed from parent in full implementation
    };

    const result = await validateCoupon(code, cart);

    if (result.valid && result.coupon) {
      setInputState('valid');
      setValidationResult(result);
      applyCoupon(result.coupon);
      onApply(code, result);
      
      // Transition to applied state after brief success display
      setTimeout(() => {
        setInputState('applied');
      }, 1000);
    } else {
      setInputState('invalid');
      setErrorMessage(result.error || 'Invalid coupon code');
    }
  }, [code, subtotal, onApply]);

  const handleRemove = useCallback(() => {
    removeCoupon();
    setCode('');
    setInputState('empty');
    setValidationResult(null);
    setErrorMessage('');
    onRemove();
  }, [onRemove]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleApply();
    }
  };

  const handleSuggestedClick = (suggestedCode: string) => {
    setCode(suggestedCode);
    setInputState('typing');
  };

  const isApplyDisabled = inputState === 'validating' || !code.trim() || inputState === 'applied';

  // Render success state
  if (inputState === 'applied' && validationResult?.valid) {
    return (
      <div className="coupon-input-container">
        <div className="coupon-applied">
          <div className="coupon-applied-content">
            <div className="coupon-icon-success">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.5 4.5L6 12L2.5 8.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="coupon-applied-info">
              <span className="coupon-code">{validationResult.coupon?.code}</span>
              <span className="coupon-discount">
                {validationResult.coupon && formatDiscountDisplay(validationResult.coupon)}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="coupon-remove-btn"
            onClick={handleRemove}
            aria-label="Remove coupon"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 1L13 13M13 1L1 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="coupon-savings">
          You saved {formatCurrency(validationResult.discountAmount)}!
        </div>
      </div>
    );
  }

  return (
    <div className="coupon-input-container">
      <div
        className={`coupon-input-wrapper ${
          inputState === 'valid' ? 'coupon-input-valid' : ''
        } ${inputState === 'invalid' ? 'coupon-input-invalid' : ''}`}
      >
        <div className="coupon-input-field">
          <input
            type="text"
            value={code}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Enter promo code"
            disabled={inputState === 'validating'}
            className="coupon-input"
            maxLength={20}
          />
          
          {/* Success checkmark */}
          {inputState === 'valid' && (
            <div className="coupon-status-icon coupon-status-success">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13.5 4.5L6 12L2.5 8.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        <button
          type="button"
          className="coupon-apply-btn"
          onClick={handleApply}
          disabled={isApplyDisabled}
        >
          {inputState === 'validating' ? (
            <span className="coupon-spinner">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="24"
                  strokeDashoffset="8"
                  strokeLinecap="round"
                >
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 8 8"
                    to="360 8 8"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </circle>
              </svg>
            </span>
          ) : (
            'Apply'
          )}
        </button>
      </div>

      {/* Error message */}
      {inputState === 'invalid' && errorMessage && (
        <div className="coupon-error">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4V8M7 10V10.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success message with discount */}
      {inputState === 'valid' && validationResult && (
        <div className="coupon-success-message">
          <span className="coupon-success-icon">✓</span>
          <span>
            Coupon applied! Discount: {formatCurrency(validationResult.discountAmount)}
          </span>
        </div>
      )}

      {/* Suggested coupons */}
      {inputState !== 'applied' && (
        <div className="coupon-suggestions">
          <span className="coupon-suggestions-label">Try:</span>
          {getSuggestedCoupons().map((suggestedCode) => (
            <button
              key={suggestedCode}
              type="button"
              className="coupon-suggestion-chip"
              onClick={() => handleSuggestedClick(suggestedCode)}
            >
              {suggestedCode}
            </button>
          ))}
        </div>
      )}

      {/* Styles */}
      <style>{`
        .coupon-input-container {
          width: 100%;
        }

        .coupon-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: stretch;
          transition: all 0.2s ease;
        }

        .coupon-input-field {
          position: relative;
          flex: 1;
        }

        .coupon-input {
          width: 100%;
          padding: 10px 12px;
          padding-right: 36px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          font-size: 14px;
          font-family: inherit;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .coupon-input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .coupon-input:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.08);
        }

        .coupon-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .coupon-input-valid .coupon-input {
          border-color: #22c55e;
          background: rgba(34, 197, 94, 0.1);
        }

        .coupon-input-invalid .coupon-input {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .coupon-status-icon {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .coupon-status-success {
          color: #22c55e;
        }

        .coupon-apply-btn {
          padding: 10px 16px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 64px;
        }

        .coupon-apply-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .coupon-apply-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .coupon-spinner {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .coupon-error {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          color: #ef4444;
          font-size: 12px;
        }

        .coupon-success-message {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          color: #22c55e;
          font-size: 12px;
          animation: coupon-fade-in 0.3s ease;
        }

        .coupon-success-icon {
          font-weight: bold;
        }

        .coupon-applied {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 8px;
          animation: coupon-slide-in 0.3s ease;
        }

        .coupon-applied-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .coupon-icon-success {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #22c55e;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
        }

        .coupon-applied-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .coupon-code {
          font-weight: 600;
          font-size: 14px;
          color: #fff;
          letter-spacing: 0.5px;
        }

        .coupon-discount {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
        }

        .coupon-remove-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .coupon-remove-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
        }

        .coupon-savings {
          margin-top: 8px;
          font-size: 12px;
          color: #22c55e;
          font-weight: 500;
        }

        .coupon-suggestions {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          flex-wrap: wrap;
        }

        .coupon-suggestions-label {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        .coupon-suggestion-chip {
          padding: 4px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .coupon-suggestion-chip:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        @keyframes coupon-fade-in {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes coupon-slide-in {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CouponInput;
