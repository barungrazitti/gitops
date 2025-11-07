import React from 'react';
import PropTypes from 'prop-types';

const Button = ({ children, variant = 'primary', size = 'medium', onClick, disabled = false }) => {
  const baseClasses = 'btn';
  const variantClass = `btn-${variant}`;
  const sizeClass = `btn-${size}`;
  
  return (
    <button
      className={`${baseClasses} ${variantClass} ${sizeClass}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

Button.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  onClick: PropTypes.func,
  disabled: PropTypes.bool
};

export default Button;