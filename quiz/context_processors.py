# quiz/context_processors.py

def avatar_context(request):
    """
    Disponibiliza as iniciais do usuário e uma cor de avatar consistente para os templates.
    """
    if request.user.is_authenticated:
        user = request.user
        
        # Gera as iniciais
        initials = ""
        if user.first_name and user.last_name:
            initials = (user.first_name[0] + user.last_name[0]).upper()
        elif user.first_name:
            initials = user.first_name[0].upper()
        else:
            initials = user.username[0].upper()
            
        # Paleta de cores moderna e profissional
        colors = [
            '#0D3B66', '#2A9D8F', '#E76F51', '#F4A261', '#6A057F', 
            '#4A4E69', '#22223B', '#0077B6', '#F77F00', '#D62828'
        ]
        
        # Escolhe uma cor da lista de forma determinística
        color_index = user.id % len(colors)
        bg_color = colors[color_index]
        
        return {
            'user_initials': initials,
            'user_avatar_bg_color': bg_color
        }
        
    return {}