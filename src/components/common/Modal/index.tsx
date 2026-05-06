import React, { FC, ReactNode } from 'react'
import { StyledModal } from './style'
interface IPops {
    open: boolean;
    children: ReactNode,
    onClick: any;
    footer?:boolean
    onCancel?:()=>void

}
const Modal: FC<IPops> = ({ open, children, footer=false, onCancel}) => {
    return (
        <StyledModal open={open} footer={footer} onCancel={onCancel}>
            {children}
        </StyledModal>
    )
}

export default Modal