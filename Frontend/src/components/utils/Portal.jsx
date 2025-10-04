import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const Portal = ({ children }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Select the div with the id 'portal-root' from your index.html
    const portalRoot = document.querySelector("#portal-root");

    // Only render the portal if the component is mounted and the target div exists
    return mounted && portalRoot
        ? createPortal(children, portalRoot)
        : null;
};

export default Portal;