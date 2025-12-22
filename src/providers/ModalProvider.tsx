import { Card } from '@/components/ui/card';
import {
  type MouseEventHandler,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ModalContext } from './ModalContext';

export const ModalProvider = ({ children }: { children: ReactNode }) => {
  const [content, setContent] = useState<ReactNode>(null);
  const openModal = useCallback((component: ReactNode) => {
    setContent(() => component);
  }, []);
  const closeModal = useCallback(() => {
    setContent(null);
  }, []);
  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {content && <ModalBackdrop onClose={closeModal}>{content}</ModalBackdrop>}
    </ModalContext.Provider>
  );
};

const ModalBackdrop = ({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) => {
  const [visible, setVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setVisible(true);
  }, []);
  const handleClose = useCallback(
    ((e) => {
      if (e.target === backdropRef.current) {
        setVisible(false);
        setTimeout(onClose, 200);
      }
    }) as MouseEventHandler<HTMLDivElement>,
    [onClose],
  );
  return createPortal(
    <div
      ref={backdropRef}
      className='fixed top-0 left-0 w-full h-full bg-[rgba(0,0,0,.5)] flex align-center justify-center z-1000 backdrop-blur-xs'
      onClick={handleClose}
    >
      <Card
        className='relative z-2'
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(-20px)',
          opacity: visible ? 1 : 0,
          transition: 'transform 200ms ease, opacity 200ms ease',
        }}
      >
        {children}
      </Card>
    </div>,
    document.body,
  );
};

export default ModalProvider;
