import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import Portal from './Portal';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText, confirmVariant = 'danger' }) => {
    if (!isOpen) return null;

    const colors = {
        danger: 'bg-red-600 hover:bg-red-700',
        primary: 'bg-indigo-600 hover:bg-indigo-700',
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 animate-fade-in">
                <div className="bg-[#1e1e1e] rounded-lg shadow-xl w-full max-w-md p-6 m-4">
                    <div className="flex items-start">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                            <FaExclamationTriangle className="h-6 w-6 text-red-400" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-medium text-white">{title}</h3>
                            <div className="mt-2">
                                <p className="text-sm text-gray-400">{message}</p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                        <button onClick={onConfirm} type="button" className={`w-full justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:w-auto sm:text-sm transition-colors ${colors[confirmVariant]}`}>
                            {confirmText}
                        </button>
                        <button onClick={onClose} type="button" className="w-full justify-center rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-transparent text-base font-medium text-gray-300 hover:bg-gray-700 sm:w-auto sm:text-sm transition-colors">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </Portal>
    );
};

export default ConfirmationModal;