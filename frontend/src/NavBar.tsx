import {NavLink, useNavigate} from 'react-router-dom'

const tabs = [
    {name: 'Home', href: '/'},
    {name: 'Review', href: '/review'},
    {name: 'Browse', href: '/browse'},
    {name: 'Add', href: '/add'}
]

function NavBar() {

    const navigate = useNavigate();

    return (
        <nav
            className="sticky top-0 z-30 h-[54px] flex items-center gap-5 px-[22px] border-b border-[var(--line)] backdrop-blur-md"
            style={{background: 'color-mix(in srgb, var(--bg) 86%, transparent)'}}
        >
            <div className="flex items-center gap-2 font-semibold tracking-[.2px] cursor-pointer"
                 onClick={() => navigate(tabs[0].href)}>
                <span
                    className="inline-flex items-center justify-center size-6 rounded-[6px] text-white text-[13px] font-bold"
                    style={{background: 'var(--accent)', lineHeight: 1}}
                >◆</span>
                <span>
                    memory<span className="text-[var(--muted)]">.db</span>
                </span>
            </div>

            <div className="flex items-center gap-1">
                {tabs.map((tab) => (
                    <NavLink
                        key={tab.name}
                        to={tab.href}
                        className="flex items-center gap-2 px-[13px] py-2 rounded-[7px] text-[13.5px] font-medium"
                        style={({isActive}) => ({color: isActive ? 'var(--text)' : 'var(--muted)'})}
                    >
                        {tab.name}
                    </NavLink>
                ))}
            </div>

            <div className="flex-1"/>
        </nav>
    )
}

export default NavBar
