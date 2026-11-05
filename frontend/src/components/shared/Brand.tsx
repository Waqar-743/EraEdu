import { Link } from 'react-router-dom';

type BrandProps = {
  to?: string;
  className?: string;
  variant?: 'light' | 'dark';
  iconOnly?: boolean;
  iconWrapperClassName?: string;
  iconClassName?: string;
  textClassName?: string;
};

// Application branding is intentionally plain. Marketing artwork lives in HomepageBrand.
const Brand = ({ to, className = '', variant = 'light', iconOnly = false, textClassName = '' }: BrandProps) => {
  const content = <span className={`inline-flex items-center font-sans font-bold ${variant === 'dark' ? 'text-white' : 'text-gray-900'} ${className} ${textClassName}`} aria-label="ERA EDU">
    {iconOnly ? <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-50 text-primary-700">E</span> : 'ERA EDU'}
  </span>;
  return to ? <Link to={to} className="inline-flex">{content}</Link> : content;
};

export default Brand;
